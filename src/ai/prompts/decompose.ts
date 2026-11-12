import type { SystemBlock } from "@/ai/client";
import type { AnalyzeResult } from "@/ai/schemas";
import { formatAnalysis } from "./context";

export const DECOMPOSE_VERSION = "decompose.v1";

const SYSTEM = `You are an expert curriculum architect.

Split the requested topic into 3-4 ordered subtopics that partition it. Partition is the hard requirement:
- No overlap: one idea belongs to exactly one subtopic.
- Nothing important missing: together the subtopics cover the whole topic at the stated level.
- Ordered: earlier subtopics teach what later ones assume.
- Each subtopic gets a short summary and 2-4 measurable objectives.

Prefer 3 subtopics; never return more than 4. Do not create a "miscellaneous" or "advanced topics" bucket.

Return only the structured object requested.`;

export function buildDecomposePrompt(input: {
  prompt: string;
  analysis: AnalyzeResult;
}): { system: SystemBlock[]; user: string } {
  return {
    system: [
      { text: SYSTEM, cache: true },
      {
        text: `COURSE TOPIC: ${input.prompt}\n\nANALYSIS\n${formatAnalysis(input.analysis)}`,
        cache: true,
      },
    ],
    user: "Partition this topic into ordered subtopics. Every lesson in the course will belong to exactly one of them.",
  };
}
