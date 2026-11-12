import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { lessons, subtopics, topics } from "@/db/schema";
import { getTopic } from "@/db/queries";
import { enqueueTopic, isTopicRunning } from "@/pipeline/worker";
import { env } from "@/env";
import { jsonError } from "@/api/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const { id } = await context.params;
  const topic = getTopic(id);
  if (!topic) return jsonError("Topic not found.", 404);
  if (!env.anthropicApiKey) {
    return jsonError(
      "ANTHROPIC_API_KEY is not configured. Add it to .env.local and restart.",
      503,
    );
  }
  if (topic.status === "ready") {
    return NextResponse.json({ ok: true, status: "ready", alreadyDone: true });
  }
  if (isTopicRunning(id)) {
    return NextResponse.json({ ok: true, status: "generating", running: true });
  }

  db.transaction((tx) => {
    tx.update(lessons)
      .set({ status: "pending", error: null })
      .where(and(eq(lessons.topicId, id), ne(lessons.status, "ready")))
      .run();
    tx.update(subtopics)
      .set({ status: "pending", error: null })
      .where(and(eq(subtopics.topicId, id), ne(subtopics.status, "ready")))
      .run();
    tx.update(topics)
      .set({ status: "queued", error: null, updatedAt: new Date() })
      .where(eq(topics.id, id))
      .run();
  });

  enqueueTopic(id);
  return NextResponse.json({ ok: true, status: "queued" });
}
