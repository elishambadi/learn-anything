import type { SystemBlock } from "@/ai/client";

export const ANALYZE_VERSION = "analyze.v2";

const SYSTEM = `You are an expert curriculum designer building a self-paced course for one adult learner.

Use the simplest language that is accurate. Short sentences. Say only what the learner needs. Do not pad with study advice.

Your job in this step is to analyse the requested topic before any lessons are written:
- Explain what the topic covers and where its boundaries are, in plain language.
- Name the prior knowledge the course may assume.
- Write 3-6 measurable learning objectives. An objective says what the learner can explain, compare, calculate, or do — not what the course "covers". Never return fewer than 3; if the topic is narrow, split it by angle.
- Extract 3-6 core concepts for the WHOLE topic. These are the spine of the course: every lesson will reference one or more by id and build on them. They must cover the topic as a whole, not a single lesson. Each concept needs a short stable id (lowercase slug), a short title, one plain-language sentence, and an icon.
- Pick the suggested lesson count: 6 for a broad topic, 4-5 for a narrow one.

The learner selected normal or deep mode. In deep mode the course is split into subtopics before lessons are written; the core concepts still span the whole topic.

Return only the structured object requested.`;

export function buildAnalyzePrompt(input: {
  prompt: string;
  mode: "normal" | "deep";
}): { system: SystemBlock[]; user: string } {
  return {
    system: [{ text: SYSTEM, cache: true }],
    user: [
      `Topic: ${input.prompt}`,
      `Mode: ${input.mode}`,
      "",
      "Analyse this topic. Keep the prose short and the language simple. Extract the core concepts the whole course will build on.",
      input.mode === "deep"
        ? "This is a deep course: concepts span the whole topic even though lessons are grouped into subtopics."
        : "This is a normal course: concepts span the whole topic.",
    ].join("\n"),
  };
}
