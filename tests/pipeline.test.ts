import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import courseConcepts from "./fixtures/course-concepts.json";

/**
 * Offline end-to-end pipeline test. A fake Anthropic-compatible endpoint:
 *  - rejects native structured outputs once, forcing the tool fallback
 *  - returns valid analyze/decompose/outline/lesson objects
 *  - deliberately returns one malformed lesson, then a valid repair
 *
 * No live API call and no real tokens.
 */

const FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/lesson-valid.json"),
    "utf8",
  ),
) as Record<string, unknown> & {
  questions: Array<Record<string, unknown>>;
};

const NON_SEQUENCE_EXTRA = {
  type: "radio",
  prompt: "Which statement about synchronous registration is true?",
  options: [
    "The user waits until every step finishes",
    "The app returns before saving the user",
    "The CRM is not called",
    "The email is sent before the account is saved",
  ],
  correct_index: 0,
  explanation: "In a synchronous flow the user waits for every dependency before the request returns.",
  difficulty: "easy",
  placement: "final",
};

function lessonInput(hasSequence: boolean) {
  const questions = FIXTURE.questions.filter(
    (question) => hasSequence || question.type !== "order",
  );
  if (!hasSequence) questions.push(NON_SEQUENCE_EXTRA);
  return { ...FIXTURE, questions };
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((block) =>
        block && typeof block === "object" && "text" in block
          ? String((block as { text: unknown }).text)
          : "",
      )
      .join("\n");
  }
  return "";
}

function toolInput(system: string, user: string, lessonCalls: number) {
  if (user.includes("Your previous response was rejected")) {
    return lessonInput(true);
  }
  if (system.includes("analyse the requested topic")) {
    return {
      summary:
        "Photosynthesis converts light energy into chemical energy, producing glucose and oxygen.",
      audience: "Curious adults with no biology background.",
      objectives: [
        "Explain what photosynthesis produces and why it matters",
        "Describe how the light reactions capture energy",
        "Explain how the Calvin cycle fixes carbon dioxide",
      ],
      concepts: courseConcepts,
      suggested_lesson_count: 4,
    };
  }
  if (system.includes("Split the requested topic")) {
    return {
      subtopics: [
        {
          title: "Capturing light",
          summary: "How chlorophyll captures photons and splits water.",
          objectives: ["Explain how photons excite electrons", "Describe water splitting"],
        },
        {
          title: "Building sugar",
          summary: "How the Calvin cycle fixes carbon dioxide.",
          objectives: ["Explain the role of RuBisCO", "Describe carbon fixation"],
        },
        {
          title: "Whole-plant balance",
          summary: "How photosynthesis interacts with respiration.",
          objectives: ["Compare photosynthesis and respiration", "Explain limiting factors"],
        },
      ],
    };
  }
  if (system.includes("lesson sequence for one unit")) {
    return {
      lessons: [
        {
          title: "Capturing light",
          objectives: [
            "Explain how chlorophyll absorbs photons",
            "Describe how water splitting releases oxygen",
          ],
          has_sequence: true,
        },
        {
          title: "The Calvin cycle",
          objectives: [
            "Explain how carbon dioxide is fixed",
            "Describe how the cycle regenerates",
          ],
          has_sequence: false,
        },
        {
          title: "Limiting factors",
          objectives: [
            "Identify factors that limit the rate",
            "Explain the effect of light intensity",
          ],
          has_sequence: false,
        },
        {
          title: "Why it matters",
          objectives: [
            "Explain photosynthesis in the food web",
            "Describe its role in the atmosphere",
          ],
          has_sequence: false,
        },
      ],
    };
  }
  // lesson
  if (lessonCalls === 1) {
    return { content_markdown: "too short", questions: [] };
  }
  const hasSequence = user.includes("teaches a real ordered sequence");
  return lessonInput(hasSequence);
}

let server: http.Server;
let topicId = "";
let lessonCalls = 0;
let analyzeCalls = 0;
let outlineCalls = 0;
let nativeRejected = false;

const handler = async (
  request: http.IncomingMessage,
  response: http.ServerResponse,
) => {
  if (request.method !== "POST" || request.url !== "/v1/messages") {
    response.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  if (body.output_config) {
    nativeRejected = true;
    response.writeHead(400, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "output_config is not supported for this account",
        },
      }),
    );
    return;
  }

  const system = textOf(body.system);
  const user = textOf(body.messages?.[0]?.content);
  if (system.includes("analyse the requested topic")) analyzeCalls += 1;
  else if (system.includes("lesson sequence for one unit")) outlineCalls += 1;
  else if (system.includes("THE SHAPE OF EVERY LESSON")) lessonCalls += 1;
  const input = toolInput(system, user, lessonCalls);

  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      id: `msg_${randomUUID()}`,
      type: "message",
      role: "assistant",
      model: body.model,
      content: [
        {
          type: "tool_use",
          id: `toolu_${randomUUID()}`,
          name: "emit_course_json",
          input,
        },
      ],
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: {
        input_tokens: 1200,
        output_tokens: 600,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    }),
  );
};

const dbFile = path.join(process.cwd(), "data/test-pipeline.db");

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbFile}${suffix}`, { force: true });
  }
  process.env.DATABASE_URL = dbFile;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.AI_CONCURRENCY = "3";

  server = http.createServer((request, response) => {
    handler(request, response).catch((error) => {
      response.writeHead(500).end(String(error));
    });
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  const { resetDbForTests } = await import("@/db/client");
  resetDbForTests();
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbFile}${suffix}`, { force: true });
  }
});

describe("pipeline", () => {
  it("produces a complete course, falls back to tools, and repairs once", async () => {
    const { db } = await import("@/db/client");
    const { topics, llmCalls } = await import("@/db/schema");
    const { getLessons, getQuestions, getTopic } = await import(
      "@/db/queries"
    );
    const { runPipeline } = await import("@/pipeline/run");

    topicId = randomUUID();
    db.insert(topics)
      .values({
        id: topicId,
        prompt: "How photosynthesis works",
        mode: "normal",
        status: "queued",
      })
      .run();

    const result = await runPipeline(topicId);
    expect(result.status).toBe("ready");
    expect(nativeRejected).toBe(true);

    const topic = getTopic(topicId);
    expect(topic?.status).toBe("ready");
    expect(topic?.analysisJson).toBeTruthy();

    const lessonRows = getLessons(topicId);
    expect(lessonRows).toHaveLength(4);
    expect(lessonRows.every((lesson) => lesson.status === "ready")).toBe(true);

    const allQuestions = lessonRows.flatMap((lesson) =>
      getQuestions(lesson.id),
    );
    expect(allQuestions.length).toBeGreaterThanOrEqual(4);

    const { getFinalQuizQuestions } = await import("@/db/queries");
    const finalQuiz = getFinalQuizQuestions(topicId);
    expect(finalQuiz).toHaveLength(lessonRows.length * 2);
    expect(lessonRows[0].contentMd).toContain("registration");
    expect(lessonRows[0].coreConceptsJson).toContain("Events, not requests");

    const callRows = db.select().from(llmCalls).all();
    expect(callRows.length).toBeGreaterThanOrEqual(7);
    expect(
      callRows.some((call) => call.purpose === "lesson.repair" && call.ok),
    ).toBe(true);
    expect(callRows.some((call) => call.purpose === "analyze")).toBe(true);

    // Two rows of each lesson's questions; no duplicate positions.
    for (const lesson of lessonRows) {
      const rows = getQuestions(lesson.id);
      expect(rows.length).toBe(4);
      expect(new Set(rows.map((row) => row.position)).size).toBe(rows.length);
    }
  });

  it("resumes without re-paying for analysis, outline, or ready lessons", async () => {
    const { db } = await import("@/db/client");
    const { topics, lessons, questions } = await import("@/db/schema");
    const { getLessons, getQuestions } = await import("@/db/queries");
    const { runPipeline } = await import("@/pipeline/run");

    const rows = getLessons(topicId);
    const target = rows[rows.length - 1];
    expect(target).toBeTruthy();

    // Simulate a crash after the outline: one lesson is unfinished, the rest
    // are already saved, and the course is stuck in "generating".
    db.transaction((tx) => {
      tx.delete(questions)
        .where(eq(questions.lessonId, target.id))
        .run();
      tx.update(lessons)
        .set({ status: "pending", contentMd: null, error: null })
        .where(eq(lessons.id, target.id))
        .run();
      tx.update(topics)
        .set({ status: "generating", error: null })
        .where(eq(topics.id, topicId))
        .run();
    });

    const before = { analyzeCalls, outlineCalls, lessonCalls };
    const result = await runPipeline(topicId);
    expect(result.status).toBe("ready");

    // The expensive shared stages were not repeated.
    expect(analyzeCalls).toBe(before.analyzeCalls);
    expect(outlineCalls).toBe(before.outlineCalls);
    expect(lessonCalls).toBe(before.lessonCalls + 1);

    const after = getLessons(topicId);
    expect(after.every((lesson) => lesson.status === "ready")).toBe(true);
    expect(getQuestions(target.id)).toHaveLength(4);
  });

  it("does not abort on schema fallbacks but does abort on billing failures", async () => {
    const { isFatalApiFailure } = await import("@/ai/client");
    expect(
      isFatalApiFailure(400, "Your credit balance is too low to access the API"),
    ).toBe(true);
    expect(isFatalApiFailure(401, "Unauthorized")).toBe(true);
    expect(isFatalApiFailure(403, "Permission denied")).toBe(true);
    expect(
      isFatalApiFailure(400, "output_config is not supported for this account"),
    ).toBe(false);
    expect(isFatalApiFailure(429, "Rate limit exceeded")).toBe(false);
    expect(isFatalApiFailure(529, "Overloaded")).toBe(false);
  });
});
