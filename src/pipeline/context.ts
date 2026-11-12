import { analyzeSchema, type AnalyzeResult } from "@/ai/schemas";
import type { LessonRow, SubtopicRow, TopicRow } from "@/db/schema";
import {
  type CourseOutline,
  type LessonOutlineEntry,
  type OutlineUnit,
} from "@/ai/prompts/context";
import { parseObjectives } from "@/quiz/serialize";

export function loadAnalysis(topic: TopicRow): AnalyzeResult | null {
  if (!topic.analysisJson) return null;
  try {
    const parsed = analyzeSchema.safeParse(JSON.parse(topic.analysisJson));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type PipelineUnit = {
  subtopic: SubtopicRow | null;
  unit: OutlineUnit;
  index: number;
  count: number;
};

export function buildUnits(
  topic: TopicRow,
  analysis: AnalyzeResult,
  subtopics: SubtopicRow[],
): PipelineUnit[] {
  const count =
    topic.mode === "deep" && subtopics.length > 0 ? subtopics.length : 1;
  if (topic.mode === "deep" && subtopics.length > 0) {
    return subtopics.map((subtopic, index) => ({
      subtopic,
      index,
      count,
      unit: {
        title: subtopic.title,
        summary: subtopic.summary,
        objectives: parseObjectives(subtopic.objectivesJson),
      },
    }));
  }
  return [
    {
      subtopic: null,
      index: 0,
      count,
      unit: {
        title: topic.prompt,
        summary: analysis.summary,
        objectives: analysis.objectives,
      },
    },
  ];
}

export function buildCourseOutline(
  topic: TopicRow,
  subtopics: SubtopicRow[],
  lessons: LessonRow[],
): CourseOutline[] {
  const toEntry = (lesson: LessonRow): LessonOutlineEntry => ({
    title: lesson.title,
    objectives: parseObjectives(lesson.objectivesJson),
    hasSequence: lesson.hasSequence,
  });

  if (topic.mode === "deep" && subtopics.length > 0) {
    return subtopics.map((subtopic) => ({
      title: subtopic.title,
      lessons: lessons
        .filter((lesson) => lesson.subtopicId === subtopic.id)
        .sort((a, b) => a.position - b.position)
        .map(toEntry),
    }));
  }

  return [
    {
      title: topic.prompt,
      lessons: [...lessons]
        .sort((a, b) => a.position - b.position)
        .map(toEntry),
    },
  ];
}
