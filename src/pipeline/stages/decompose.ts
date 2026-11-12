import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { subtopics, topics, type SubtopicRow, type TopicRow } from "@/db/schema";
import { callWithRepair } from "@/ai/repair";
import { decomposeSchema, type AnalyzeResult } from "@/ai/schemas";
import {
  DECOMPOSE_VERSION,
  buildDecomposePrompt,
} from "@/ai/prompts/decompose";

export async function generateSubtopics(
  topic: TopicRow,
  analysis: AnalyzeResult,
  jobId: string,
): Promise<SubtopicRow[]> {
  const prompt = buildDecomposePrompt({
    prompt: topic.prompt,
    analysis,
  });

  const result = await callWithRepair({
    purpose: "decompose",
    promptVersion: DECOMPOSE_VERSION,
    schema: decomposeSchema,
    system: prompt.system,
    user: prompt.user,
    mode: topic.mode,
    maxTokens: 2000,
    topicId: topic.id,
    jobId,
  });

  const rows: SubtopicRow[] = result.data.subtopics.map((subtopic, index) => ({
    id: randomUUID(),
    topicId: topic.id,
    position: index,
    title: subtopic.title,
    summary: subtopic.summary,
    objectivesJson: JSON.stringify(subtopic.objectives),
    status: "pending" as const,
    error: null,
  }));

  db.transaction((tx) => {
    for (const row of rows) {
      tx.insert(subtopics).values(row).run();
    }
    tx.update(topics)
      .set({ updatedAt: new Date() })
      .where(eq(topics.id, topic.id))
      .run();
  });

  return rows;
}
