import { NextResponse } from "next/server";
import { getTopic } from "@/db/queries";
import { topicProgress } from "@/api/topic-view";
import { jsonError } from "@/api/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const topic = getTopic(id);
  if (!topic) return jsonError("Topic not found.", 404);
  return NextResponse.json(topicProgress(topic));
}
