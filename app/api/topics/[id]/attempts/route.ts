import { NextResponse } from "next/server";
import { getTopic, getTopicAttempts } from "@/db/queries";
import { jsonError } from "@/api/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!getTopic(id)) return jsonError("Topic not found.", 404);
  return NextResponse.json({ attempts: getTopicAttempts(id) });
}
