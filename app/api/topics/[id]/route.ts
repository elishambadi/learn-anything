import { NextResponse } from "next/server";
import { deleteTopic, getTopic } from "@/db/queries";
import { topicDetail } from "@/api/topic-view";
import { jsonError } from "@/api/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const topic = getTopic(id);
  if (!topic) return jsonError("Topic not found.", 404);
  return NextResponse.json(topicDetail(topic));
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!deleteTopic(id)) return jsonError("Topic not found.", 404);
  return NextResponse.json({ ok: true });
}
