import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { topics } from "@/db/schema";
import { callWithRepair } from "@/ai/repair";
import { analyzeSchema, type AnalyzeResult } from "@/ai/schemas";
import {
  ANALYZE_VERSION,
  buildAnalyzePrompt,
} from "@/ai/prompts/analyze";
import type { TopicRow } from "@/db/schema";

export async function generateAnalysis(
  topic: TopicRow,
  jobId: string,
): Promise<AnalyzeResult> {
  const prompt = buildAnalyzePrompt({
    prompt: topic.prompt,
    mode: topic.mode,
  });

  const result = await callWithRepair({
    purpose: "analyze",
    promptVersion: ANALYZE_VERSION,
    schema: analyzeSchema,
    system: prompt.system,
    user: prompt.user,
    mode: topic.mode,
    maxTokens: 1500,
    topicId: topic.id,
    jobId,
    check: (data) => {
      const errors: string[] = [];
      if (data.concepts.length < 3 || data.concepts.length > 6) {
        errors.push("Return 3-6 core concepts for the whole course.");
      }
      const ids = new Set(data.concepts.map((concept) => concept.id));
      if (ids.size !== data.concepts.length) {
        errors.push("Core concept ids must be unique.");
      }
      return errors;
    },
  });

  db.update(topics)
    .set({
      analysisJson: JSON.stringify(result.data),
      updatedAt: new Date(),
    })
    .where(eq(topics.id, topic.id))
    .run();

  return result.data;
}
