import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { topics } from "@/db/schema";
import { listTopics } from "@/db/queries";
import { enqueueTopic } from "@/pipeline/worker";
import { env } from "@/env";
import { jsonError } from "@/api/http";

export const dynamic = "force-dynamic";

const createTopicSchema = z.object({
  prompt: z.string().trim().min(3).max(500),
  mode: z.enum(["normal", "deep"]),
});

export async function GET() {
  return NextResponse.json({ topics: listTopics() });
}

export async function POST(request: Request) {
  if (!env.anthropicApiKey) {
    return jsonError(
      "ANTHROPIC_API_KEY is not configured. Add it to .env.local and restart.",
      503,
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createTopicSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "Body must be { prompt: string (3-500 chars), mode: 'normal' | 'deep' }.",
    );
  }

  const id = randomUUID();
  db.insert(topics)
    .values({
      id,
      prompt: parsed.data.prompt,
      mode: parsed.data.mode,
      status: "queued",
    })
    .run();

  enqueueTopic(id);
  return NextResponse.json({ id }, { status: 201 });
}
