import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  lessons,
  subtopics,
  type LessonRow,
  type SubtopicRow,
  type TopicRow,
} from "@/db/schema";
import { callWithRepair } from "@/ai/repair";
import { outlineSchema, type AnalyzeResult } from "@/ai/schemas";
import {
  OUTLINE_VERSION,
  buildOutlinePrompt,
} from "@/ai/prompts/outline";
import type { OutlineUnit } from "@/ai/prompts/context";

export async function generateOutline(input: {
  topic: TopicRow;
  analysis: AnalyzeResult;
  unit: OutlineUnit;
  unitIndex: number;
  unitCount: number;
  subtopic: SubtopicRow | null;
  jobId: string;
}): Promise<LessonRow[]> {
  const prompt = buildOutlinePrompt({
    prompt: input.topic.prompt,
    analysis: input.analysis,
    unit: input.unit,
    unitIndex: input.unitIndex,
    unitCount: input.unitCount,
    mode: input.topic.mode,
  });

  const result = await callWithRepair({
    purpose: "outline",
    promptVersion: OUTLINE_VERSION,
    schema: outlineSchema,
    system: prompt.system,
    user: prompt.user,
    mode: input.topic.mode,
    maxTokens: 1800,
    topicId: input.topic.id,
    jobId: input.jobId,
  });

  // Deep mode is budgeted at 4-5 lessons per unit. Trim an over-eager sixth
  // lesson rather than paying for a larger course than requested.
  const outlineLessons = result.data.lessons.slice(
    0,
    input.topic.mode === "deep" ? 5 : 6,
  );

  const rows: LessonRow[] = outlineLessons.map((lesson, index) => ({
    id: randomUUID(),
    topicId: input.topic.id,
    subtopicId: input.subtopic?.id ?? null,
    position: index,
    title: lesson.title,
    objectivesJson: JSON.stringify(lesson.objectives),
    hasSequence: lesson.has_sequence,
    summary: null,
    heroQuery: null,
    coreConceptsJson: null,
    sectionsJson: null,
    closingJson: null,
    comparisonJson: null,
    realWorldJson: null,
    contentMd: null,
    assignment: null,
    completedAt: null,
    status: "pending" as const,
    error: null,
    model: null,
    inputTokens: null,
    outputTokens: null,
  }));

  db.transaction((tx) => {
    for (const row of rows) {
      tx.insert(lessons).values(row).run();
    }
    if (input.subtopic) {
      tx.update(subtopics)
        .set({ status: "generating", error: null })
        .where(eq(subtopics.id, input.subtopic.id))
        .run();
    }
  });

  return rows;
}
