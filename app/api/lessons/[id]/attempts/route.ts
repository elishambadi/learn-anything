import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { answers, attempts } from "@/db/schema";
import { getLesson, getQuestions } from "@/db/queries";
import { grade } from "@/quiz/grade";
import { jsonError } from "@/api/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const attemptSchema = z.object({
  responses: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const lesson = getLesson(id);
  if (!lesson) return jsonError("Lesson not found.", 404);
  if (lesson.status !== "ready") {
    return jsonError(`Lesson is ${lesson.status}, not ready yet.`, 409);
  }

  const body = await request.json().catch(() => null);
  const parsed = attemptSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Body must be { responses: { [questionId]: value } }.");
  }

  const questionRows = getQuestions(lesson.id);
  if (questionRows.length === 0) {
    return jsonError("This lesson has no questions.", 409);
  }

  const responses = parsed.data.responses;
  const known = new Set(questionRows.map((question) => question.id));
  const unknown = Object.keys(responses).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    return jsonError(`Unknown question id(s): ${unknown.join(", ")}.`);
  }
  const missing = questionRows
    .filter((question) => !(question.id in responses))
    .map((question) => question.id);
  if (missing.length > 0) {
    return jsonError(`Answer every question first. Missing: ${missing.join(", ")}.`);
  }

  const graded = questionRows.map((question) => {
    const response = responses[question.id];
    return {
      question,
      response,
      ...grade(question, response),
    };
  });
  const score = graded.filter((result) => result.isCorrect).length;
  const attemptId = randomUUID();

  db.transaction((tx) => {
    tx.insert(attempts)
      .values({
        id: attemptId,
        topicId: lesson.topicId,
        lessonId: lesson.id,
        score,
        total: questionRows.length,
      })
      .run();
    for (const result of graded) {
      tx.insert(answers)
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
      lessonId: lesson.id,
      score,
      total: questionRows.length,
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
