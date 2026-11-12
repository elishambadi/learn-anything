import { NextResponse } from "next/server";
import {
  getFinalQuizQuestions,
  getFinalQuizSummary,
  getTopic,
} from "@/db/queries";
import { toPublicQuestion } from "@/quiz/serialize";
import { jsonError } from "@/api/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const topic = getTopic(id);
  if (!topic) return jsonError("Topic not found.", 404);

  const questions = getFinalQuizQuestions(id);
  return NextResponse.json({
    topic: { id: topic.id, prompt: topic.prompt, mode: topic.mode },
    questions: questions.map((item) => ({
      ...toPublicQuestion(item.question),
      lessonId: item.lessonId,
      lessonTitle: item.lessonTitle,
    })),
    attemptSummary: getFinalQuizSummary(id) ?? null,
  });
}
