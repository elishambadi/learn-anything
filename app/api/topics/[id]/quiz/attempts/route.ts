import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { quizAnswers, quizAttempts } from "@/db/schema";
import {
  getFinalQuizQuestions,
  getTopic,
} from "@/db/queries";
import { grade } from "@/quiz/grade";
import { jsonError } from "@/api/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const attemptSchema = z.object({
  responses: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const topic = getTopic(id);
  if (!topic) return jsonError("Topic not found.", 404);
  if (topic.status !== "ready") {
    return jsonError("The course is not ready.", 409);
  }

  const body = await request.json().catch(() => null);
  const parsed = attemptSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Body must be { responses: { [questionId]: value } }.");
  }

  const items = getFinalQuizQuestions(id);
  if (items.length === 0) {
    return jsonError("This course has no final quiz questions.", 409);
  }

  const responses = parsed.data.responses;
  const known = new Set(items.map((item) => item.question.id));
  const unknown = Object.keys(responses).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    return jsonError(`Unknown question id(s): ${unknown.join(", ")}.`);
  }
  const missing = items
    .filter((item) => !(item.question.id in responses))
    .map((item) => item.question.id);
  if (missing.length > 0) {
    return jsonError(`Answer every question first. Missing: ${missing.join(", ")}.`);
  }

  const graded = items.map((item) => ({
    question: item.question,
    response: responses[item.question.id],
    ...grade(item.question, responses[item.question.id]),
  }));
  const score = graded.filter((result) => result.isCorrect).length;
  const attemptId = randomUUID();

  db.transaction((tx) => {
    tx.insert(quizAttempts)
      .values({
        id: attemptId,
        topicId: id,
        score,
        total: items.length,
      })
      .run();
    for (const result of graded) {
      tx.insert(quizAnswers)
        .values({
          id: randomUUID(),
          attemptId,
          questionId: result.question.id,
          responseJson: JSON.stringify(result.response ?? null),
          isCorrect: result.isCorrect,
        })
        .run();
    }
  });

  return NextResponse.json(
    {
      attemptId,
      score,
      total: items.length,
      results: graded.map((result) => ({
        questionId: result.question.id,
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        explanation: result.question.explanation,
      })),
    },
    { status: 201 },
  );
}
