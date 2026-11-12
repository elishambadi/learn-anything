import { analyzeSchema } from "@/ai/schemas";
import type { TopicRow } from "@/db/schema";
import { getLessons, getSubtopics } from "@/db/queries";
import { parseObjectives } from "@/quiz/serialize";

export function parseAnalysis(topic: TopicRow) {
  if (!topic.analysisJson) return null;
  try {
    const parsed = analyzeSchema.safeParse(JSON.parse(topic.analysisJson));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function topicDetail(topic: TopicRow) {
  const subtopics = getSubtopics(topic.id);
  const lessons = getLessons(topic.id);
  return {
    topic: {
      id: topic.id,
      prompt: topic.prompt,
      mode: topic.mode,
      status: topic.status,
      error: topic.error,
      analysis: parseAnalysis(topic),
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
    },
    subtopics: subtopics.map((subtopic) => ({
      id: subtopic.id,
      position: subtopic.position,
      title: subtopic.title,
      summary: subtopic.summary,
      objectives: parseObjectives(subtopic.objectivesJson),
      status: subtopic.status,
      error: subtopic.error,
    })),
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      subtopicId: lesson.subtopicId,
      position: lesson.position,
      title: lesson.title,
      objectives: parseObjectives(lesson.objectivesJson),
      hasSequence: lesson.hasSequence,
      status: lesson.status,
      error: lesson.error,
    })),
  };
}

export type TopicProgressStage =
  | "queued"
  | "analyze"
  | "decompose"
  | "outline"
  | "lessons"
  | "done";

export function topicProgress(topic: TopicRow) {
  const subtopics = getSubtopics(topic.id);
  const lessons = getLessons(topic.id);

  let stage: TopicProgressStage = "done";
  if (topic.status === "queued") stage = "queued";
  else if (topic.status === "generating") {
    if (!topic.analysisJson) stage = "analyze";
    else if (topic.mode === "deep" && subtopics.length === 0)
      stage = "decompose";
    else if (lessons.length === 0) stage = "outline";
    else stage = "lessons";
  }

  const done = lessons.filter((lesson) => lesson.status === "ready").length;
  const failed = lessons.filter((lesson) => lesson.status === "failed").length;

  return {
    id: topic.id,
    status: topic.status,
    stage,
    error: topic.error,
    lessons: { done, failed, total: lessons.length },
    units:
      subtopics.length > 0
        ? subtopics.map((subtopic) => {
            const unitLessons = lessons.filter(
              (lesson) => lesson.subtopicId === subtopic.id,
            );
            return {
              id: subtopic.id,
              title: subtopic.title,
              status: subtopic.status,
              done: unitLessons.filter(
                (lesson) => lesson.status === "ready",
              ).length,
              total: unitLessons.length,
            };
          })
        : [
            {
              id: null,
              title: topic.prompt,
              status: topic.status,
              done,
              total: lessons.length,
            },
          ],
    lessonStates: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      status: lesson.status,
      subtopicId: lesson.subtopicId,
    })),
  };
}
