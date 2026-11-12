import { NextResponse } from "next/server";
import { getLesson, markLessonComplete } from "@/db/queries";
import { jsonError } from "@/api/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const { id } = await context.params;
  const lesson = getLesson(id);
  if (!lesson) return jsonError("Lesson not found.", 404);
  markLessonComplete(id);
  return NextResponse.json({ ok: true });
}
