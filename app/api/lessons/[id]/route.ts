import { NextResponse } from "next/server";
import {
  getAttemptSummaryByLesson,
  getLesson,
  getNextLesson,
  getQuestions,
  getTopic,
} from "@/db/queries";
import { toPublicLesson } from "@/quiz/serialize";
import { jsonError } from "@/api/http";
import { parseAnalysis } from "@/api/topic-view";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const lesson = getLesson(id);
  if (!lesson) return jsonError("Lesson not found.", 404);

  const topic = getTopic(lesson.topicId);
  if (!topic) return jsonError("Topic not found.", 404);

  if (lesson.status !== "ready" && !lesson.contentMd) {
    return jsonError(`Lesson is ${lesson.status}, not ready yet.`, 409);
  }

  const questionRows = getQuestions(lesson.id);
  const next = getNextLesson(lesson.topicId, lesson.id);
  const attemptSummary =
    getAttemptSummaryByLesson(lesson.topicId).get(lesson.id) ?? null;

  return NextResponse.json({
    ...toPublicLesson(lesson, questionRows, parseAnalysis(topic)?.concepts ?? []),
    topic: { id: topic.id, prompt: topic.prompt, mode: topic.mode },
    nextLesson: next ? { id: next.id, title: next.title } : null,
    attemptSummary,
  });
}
