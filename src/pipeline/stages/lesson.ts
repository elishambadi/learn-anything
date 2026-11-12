import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  lessons,
  questions,
  type LessonRow,
  type TopicRow,
} from "@/db/schema";
import { callWithRepair } from "@/ai/repair";
import { lessonSchema, type AnalyzeResult } from "@/ai/schemas";
import {
  LESSON_VERSION,
  buildLessonPrompt,
} from "@/ai/prompts/lesson";
import type { CourseOutline, OutlineUnit } from "@/ai/prompts/context";
import {
  isGroundingLintError,
  isSoftLintError,
  lintLesson,
  resolveFocusConcepts,
} from "@/quiz/lint";
import { storeQuestions } from "@/quiz/shuffle";
import { parseObjectives } from "@/quiz/serialize";
import { sectionsToMarkdown } from "@/quiz/markdown";

export function cleanMarkdown(content: string): string {
  const trimmed = content.trim();
  const fence = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  const body = fence ? fence[1].trim() : trimmed;
  // The page already renders the lesson title. Drop a duplicated leading H1
  // when the body also has section headings.
  if (/^#\s+[^\n]+\n+##\s/m.test(body)) {
    return body.replace(/^#\s+[^\n]+\n+/, "").trim();
  }
  return body;
}

export async function generateLesson(input: {
  topic: TopicRow;
  analysis: AnalyzeResult;
  lesson: LessonRow;
  unit: OutlineUnit;
  unitIndex: number;
  unitCount: number;
  outline: CourseOutline[];
  lessonIndex: number;
  lessonCount: number;
  jobId: string;
}): Promise<LessonRow> {
  const objectives = parseObjectives(input.lesson.objectivesJson);

  db.update(lessons)
    .set({ status: "generating", error: null })
    .where(eq(lessons.id, input.lesson.id))
    .run();

  const prompt = buildLessonPrompt({
    prompt: input.topic.prompt,
    mode: input.topic.mode,
    analysis: input.analysis,
    unit: input.unit,
    unitIndex: input.unitIndex,
    unitCount: input.unitCount,
    outline: input.outline,
    lessonIndex: input.lessonIndex,
    lessonCount: input.lessonCount,
    title: input.lesson.title,
    objectives,
    hasSequence: input.lesson.hasSequence,
  });

  const result = await callWithRepair({
    purpose: "lesson",
    promptVersion: LESSON_VERSION,
    schema: lessonSchema,
    system: prompt.system,
    user: prompt.user,
    mode: input.topic.mode,
    maxTokens: 4000,
    topicId: input.topic.id,
    jobId: input.jobId,
    check: (data) => {
      const errors = lintLesson(data, {
        hasSequence: input.lesson.hasSequence,
        objectives,
        concepts: input.analysis.concepts ?? [],
      });
      const hard = errors.filter((error) => !isSoftLintError(error));
      const soft = errors.filter(isSoftLintError);
      if (soft.length > 0) {
        console.warn(
          `Lesson "${input.lesson.title}" soft lint warnings: ${soft.join("; ")}`,
        );
      }
      return hard;
    },
    maxRepairs: 3,
    allowRemaining: (errors) => {
      const acceptable = errors.every(
        (error) => isSoftLintError(error) || isGroundingLintError(error),
      );
      if (acceptable) {
        console.warn(
          `Lesson "${input.lesson.title}" accepted with warnings: ${errors.join("; ")}`,
        );
      }
      return acceptable;
    },
  });

  const sections = result.data.sections.map((section) => ({
    ...section,
    body_markdown: cleanMarkdown(section.body_markdown),
  }));
  const contentMd = sectionsToMarkdown(sections);
  const focusConcepts = resolveFocusConcepts(
    result.data.focus_concept_ids,
    input.analysis.concepts ?? [],
  );
  const stored = storeQuestions(result.data.questions);

  db.transaction((tx) => {
    tx.delete(questions)
      .where(eq(questions.lessonId, input.lesson.id))
      .run();
    for (const question of stored) {
      tx.insert(questions)
        .values({ ...question, lessonId: input.lesson.id })
        .run();
    }
    tx.update(lessons)
      .set({
        contentMd,
        summary: result.data.promise,
        heroQuery: result.data.hero_image_query,
        coreConceptsJson: JSON.stringify(focusConcepts),
        assignment: result.data.assignment,
        sectionsJson: JSON.stringify(sections),
        closingJson: null,
        comparisonJson: null,
        realWorldJson: null,
        status: "ready",
        error: null,
        model: result.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      })
      .where(eq(lessons.id, input.lesson.id))
      .run();
  });

  return {
    ...input.lesson,
    contentMd,
    status: "ready",
    error: null,
    model: result.model,
  };
}
