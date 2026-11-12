import type { SystemBlock } from "@/ai/client";
import type { AnalyzeResult } from "@/ai/schemas";
import { formatAnalysis, formatUnit, type OutlineUnit } from "./context";

export const OUTLINE_VERSION = "outline.v1";

const SYSTEM = `You are an expert curriculum architect designing the lesson sequence for one unit of a course.

Rules:
- Produce 4-6 lessons in teaching order (4-5 in deep mode).
- Each lesson gets 2-3 measurable objectives and a title a learner can scan.
- Lessons must not repeat each other. Each one should have a single clear job.
- has_sequence is true only when the lesson teaches a real ordered process (a pipeline, procedure, timeline, or derivation). It gates "arrange in order" quiz questions, so do not set it casually.
- Cover the unit objectives without adding unrelated material.

Return only the structured object requested.`;

export function buildOutlinePrompt(input: {
  prompt: string;
  analysis: AnalyzeResult;
  unit: OutlineUnit;
  unitIndex: number;
  unitCount: number;
  mode: "normal" | "deep";
}): { system: SystemBlock[]; user: string } {
  return {
    system: [
      { text: SYSTEM, cache: true },
      {
        text: [
          `COURSE TOPIC: ${input.prompt}`,
          "",
          "ANALYSIS",
          formatAnalysis(input.analysis),
        ].join("\n"),
        cache: true,
      },
    ],
    user: [
      formatUnit(
        input.unit,
        `UNIT ${input.unitIndex + 1} OF ${input.unitCount}`,
      ),
      "",
      input.mode === "deep"
        ? "Design 4-5 lessons for this deep-mode unit."
        : "Design 4-6 lessons for this unit.",
    ].join("\n"),
  };
}
