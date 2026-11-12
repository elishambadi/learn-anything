import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { topics } from "@/db/schema";
import { getTopicCost } from "@/db/cost";
import {
  getQuestions,
  getOrderedLessons,
  getSubtopics,
  getTopic,
} from "@/db/queries";
import { runPipeline, type PipelineStage } from "@/pipeline/run";
import { estimateCostUsd } from "@/ai/client";
import { visualToMarkdown } from "@/quiz/markdown";
import type { LessonClosing, LessonSection } from "@/ai/schemas";
import { env } from "@/env";
import type { LessonRow, QuestionRow, SubtopicRow } from "@/db/schema";

type Args = {
  prompt: string;
  mode: "normal" | "deep";
  out: string | null;
};

function usage(): string {
  return [
    "Usage: pnpm gen \"Photosynthesis\" [--deep] [--out path.md]",
    "",
    "  --deep        decompose the topic into subtopics first",
    "  --out <path>  write the course markdown to this path",
    "",
    "Requires ANTHROPIC_API_KEY in .env.local.",
  ].join("\n");
}

function parseArgs(argv: string[]): Args | null {
  const words: string[] = [];
  let mode: "normal" | "deep" = "normal";
  let out: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--deep" || arg === "-d") mode = "deep";
    else if (arg === "--out" || arg === "-o") {
      out = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.error(usage());
      process.exit(0);
    } else words.push(arg);
  }
  const prompt = words.join(" ").trim();
  if (!prompt) return null;
  return { prompt, mode, out };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function optionMap(question: QuestionRow): Map<string, string> {
  try {
    const options = JSON.parse(question.optionsJson) as Array<{
      id: string;
      text: string;
    }>;
    return new Map(options.map((option) => [option.id, option.text]));
  } catch {
    return new Map();
  }
}

function formatAnswer(question: QuestionRow): string {
  let answer: Record<string, unknown>;
  try {
    answer = JSON.parse(question.answerJson) as Record<string, unknown>;
  } catch {
    return "—";
  }
  const options = optionMap(question);

  if (question.type === "true_false") {
    return answer.value === true ? "True" : "False";
  }
  if (question.type === "radio") {
    const id = String(answer.optionId ?? "");
    return options.get(id) ?? id;
  }
  if (question.type === "multi") {
    const ids = Array.isArray(answer.optionIds)
      ? (answer.optionIds as string[])
      : [];
    return ids.map((id) => options.get(id) ?? id).join(" · ");
  }
  const ids = Array.isArray(answer.itemIds)
    ? (answer.itemIds as string[])
    : [];
  return ids.map((id) => options.get(id) ?? id).join(" → ");
}

function formatQuestion(question: QuestionRow, index: number): string {
  const lines = [
    `${index + 1}. (${question.type} · ${question.difficulty} · ${question.placement}) ${question.prompt}`,
  ];
  try {
    const options = JSON.parse(question.optionsJson) as Array<{
      id: string;
      text: string;
    }>;
    if (question.type !== "true_false") {
      for (const option of options) {
        lines.push(`   - [${option.id}] ${option.text}`);
      }
    }
  } catch {
    // Leave the malformed options out of the export.
  }
  lines.push(`   **Answer:** ${formatAnswer(question)}`);
  lines.push(`   **Why:** ${question.explanation}`);
  return lines.join("\n");
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function formatLesson(lesson: LessonRow, questions: QuestionRow[]): string {
  const concepts = parseJson<
    Array<{ title: string; description: string; icon: string }>
  >(lesson.coreConceptsJson, []);
  const comparison = parseJson<{
    title: string;
    columns: string[];
    rows: string[][];
  } | null>(lesson.comparisonJson, null);
  const sections = parseJson<LessonSection[]>(lesson.sectionsJson, []);
  const closing = parseJson<LessonClosing | null>(lesson.closingJson, null);
  const realWorld = parseJson<{
    title: string;
    description: string;
    link: { label: string; url: string } | null;
    code: { language: string; code: string } | null;
    try_this: string;
  } | null>(lesson.realWorldJson, null);

  const lines = [`### ${lesson.title}`, ""];

  if (lesson.summary) {
    lines.push(`> ${lesson.summary}`, "");
  }

  lines.push(
    ...(() => {
      try {
        const objectives = JSON.parse(lesson.objectivesJson) as string[];
        return ["**Objectives**", ...objectives.map((item) => `- ${item}`), ""];
      } catch {
        return [];
      }
    })(),
  );

  if (concepts.length > 0) {
    lines.push(
      "**Core concepts**",
      ...concepts.map(
        (concept) =>
          `- **${concept.title}** (${concept.icon}): ${concept.description}`,
      ),
      "",
    );
  }

  if (sections.length > 0) {
    for (const section of sections) {
      lines.push(`**${section.heading}**`, "", section.body_markdown, "");
      const visual = visualToMarkdown(section.visual);
      if (visual) lines.push(visual, "");
    }
    if (closing) {
      lines.push(`**${closing.heading}**`, "", closing.body_markdown, "");
    }
  } else {
    if (comparison) {
      lines.push(
        `**${comparison.title}**`,
        "",
        `| ${comparison.columns.join(" | ")} |`,
        `| ${comparison.columns.map(() => "---").join(" | ")} |`,
        ...comparison.rows.map((row) => `| ${row.join(" | ")} |`),
        "",
      );
    }

    if (lesson.contentMd) {
      lines.push(lesson.contentMd, "");
    }
  }

  if (realWorld) {
    lines.push(
      `**Real world: ${realWorld.title}**`,
      "",
      realWorld.description,
      "",
    );
    if (realWorld.link) {
      lines.push(`[${realWorld.link.label}](${realWorld.link.url})`, "");
    }
    if (realWorld.code) {
      lines.push(
        "```" + realWorld.code.language,
        realWorld.code.code,
        "```",
        "",
      );
    }
    lines.push(`**Try this:** ${realWorld.try_this}`, "");
  }

  lines.push(
    "#### Quiz",
    "",
    ...questions.map(formatQuestion),
    "",
  );
  return lines.join("\n");
}

function exportMarkdown(
  prompt: string,
  mode: string,
  status: string,
  subtopics: SubtopicRow[],
  lessons: LessonRow[],
  questionsByLesson: Map<string, QuestionRow[]>,
): string {
  const lines = [
    `# ${prompt}`,
    "",
    `> ${mode} mode · ${status} · generated ${new Date().toISOString()}`,
    "",
  ];
  const bySubtopic = new Map<string, LessonRow[]>();
  for (const lesson of lessons) {
    const key = lesson.subtopicId ?? "__single__";
    const list = bySubtopic.get(key) ?? [];
    list.push(lesson);
    bySubtopic.set(key, list);
  }

  if (subtopics.length > 0) {
    subtopics.forEach((subtopic, index) => {
      lines.push(`## ${index + 1}. ${subtopic.title}`, "", subtopic.summary, "");
      for (const lesson of bySubtopic.get(subtopic.id) ?? []) {
        lines.push(
          formatLesson(lesson, questionsByLesson.get(lesson.id) ?? []),
        );
      }
    });
  } else {
    for (const lesson of bySubtopic.get("__single__") ?? []) {
      lines.push(formatLesson(lesson, questionsByLesson.get(lesson.id) ?? []));
    }
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(usage());
    process.exit(1);
  }
  if (!env.anthropicApiKey) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local, then run this again.",
    );
    process.exit(1);
  }

  const id = randomUUID();
  db.insert(topics)
    .values({
      id,
      prompt: args.prompt,
      mode: args.mode,
      status: "queued",
    })
    .run();

  console.log(`\n  ${args.prompt}`);
  console.log(`  ${args.mode} mode · ${id}\n`);

  const seen = new Set<PipelineStage>();
  const onProgress = (progress: { stage: PipelineStage; message: string }) => {
    if (seen.has(progress.stage)) return;
    seen.add(progress.stage);
    console.log(`  → ${progress.message}`);
  };

  const result = await runPipeline(id, { onProgress });
  const topic = getTopic(id);
  const subtopics = getSubtopics(id);
  const lessons = getOrderedLessons(id);
  const questionsByLesson = new Map(
    lessons.map((lesson) => [lesson.id, getQuestions(lesson.id)]),
  );

  const markdown = exportMarkdown(
    args.prompt,
    args.mode,
    topic?.status ?? result.status,
    subtopics,
    lessons,
    questionsByLesson,
  );

  const outPath =
    args.out ??
    path.join("data", `${slugify(args.prompt)}-${id.slice(0, 8)}.md`);
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, markdown, "utf8");

  const cost = await getTopicCost(id);
  const usd = cost
    ? estimateCostUsd({
        inputTokens: cost.inputTokens,
        cacheReadTokens: cost.cacheReadTokens,
        outputTokens: cost.outputTokens,
      })
    : 0;

  const ready = lessons.filter((lesson) => lesson.status === "ready").length;
  const questions = lessons.reduce(
    (total, lesson) => total + (questionsByLesson.get(lesson.id)?.length ?? 0),
    0,
  );

  console.log("");
  console.log(`  status:     ${result.status}`);
  console.log(`  lessons:    ${ready}/${lessons.length} ready`);
  console.log(`  questions:  ${questions}`);
  console.log(`  model:      ${env.model}${args.mode === "deep" && env.modelDeep ? ` (deep: ${env.modelDeep})` : ""}`);
  console.log(`  tokens:     ${cost?.inputTokens ?? 0} in / ${cost?.cacheReadTokens ?? 0} cached / ${cost?.outputTokens ?? 0} out`);
  console.log(`  est. cost:  $${usd.toFixed(3)}`);
  console.log(`  markdown:   ${outPath}`);
  if (result.error) console.log(`  error:      ${result.error}`);
  console.log("");

  process.exit(result.status === "failed" ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
