import { sql } from "drizzle-orm";
import { db } from "./client";
import { llmCalls } from "./schema";

export async function getTopicCost(topicId: string) {
  return db
    .select({
      calls: sql<number>`count(*)`,
      inputTokens: sql<number>`coalesce(sum(${llmCalls.inputTokens}), 0)`,
      cacheReadTokens: sql<number>`coalesce(sum(${llmCalls.cacheReadTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${llmCalls.outputTokens}), 0)`,
    })
    .from(llmCalls)
    .where(sql`${llmCalls.topicId} = ${topicId}`)
    .get();
}
