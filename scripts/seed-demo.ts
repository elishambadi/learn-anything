/**
 * Seed a ready-made deep course so the read/grade UI can be exercised without
 * spending model tokens. Run with: pnpm tsx scripts/seed-demo.ts
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { lessons, questions, subtopics, topics } from "@/db/schema";
import { storeQuestions } from "@/quiz/shuffle";
import { lessonSchema } from "@/ai/schemas";
import { sectionsToMarkdown } from "@/quiz/markdown";

const fixture = lessonSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "tests/fixtures/lesson-valid.json"),
      "utf8",
    ),
  ),
);

const courseConcepts = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/course-concepts.json"),
    "utf8",
  ),
) as Array<{ id: string; title: string; description: string; icon: string }>;

const focusConcepts = courseConcepts.filter((concept) =>
  fixture.focus_concept_ids.includes(concept.id),
);

const topicId = randomUUID();
const analysis = {
  summary:
    "Event-driven architecture replaces direct calls with events that independent consumers can handle later. The course separates the event model from the practical choices for delivering events.",
  audience: "Developers who have built a request-response service and want to understand background work.",
  objectives: [
    "Explain how events decouple a publisher from its consumers",
    "Compare synchronous and event-driven registration flows",
    "Choose between a task, a stateful process, and pub/sub",
  ],
  concepts: courseConcepts,
  suggested_lesson_count: 4,
};

const unitSpecs = [
  {
    title: "Events and independent consumers",
    summary:
      "How an event lets a publisher hand work to consumers without waiting for them.",
    objectives: [
      "Explain what an event records",
      "Describe how consumers subscribe independently",
    ],
  },
  {
    title: "Choosing a delivery mechanism",
    summary:
      "When to use a task, a stateful process, or a pub/sub topic.",
    objectives: [
      "Compare background tasks with pub/sub",
      "Explain eventual consistency and idempotency",
    ],
  },
];

db.transaction((tx) => {
  tx.insert(topics)
    .values({
      id: topicId,
      prompt: "Event-Driven Architecture (demo)",
      mode: "deep",
      status: "ready",
      analysisJson: JSON.stringify(analysis),
    })
    .run();

  unitSpecs.forEach((unit, unitIndex) => {
    const subtopicId = randomUUID();
    tx.insert(subtopics)
      .values({
        id: subtopicId,
        topicId,
        position: unitIndex,
        title: unit.title,
        summary: unit.summary,
        objectivesJson: JSON.stringify(unit.objectives),
        status: "ready",
      })
      .run();

    const lessonId = randomUUID();
    tx.insert(lessons)
      .values({
        id: lessonId,
        topicId,
        subtopicId,
        position: 0,
        title: unit.title,
        objectivesJson: JSON.stringify(unit.objectives),
        hasSequence: true,
        summary: fixture.promise,
        heroQuery: fixture.hero_image_query,
        coreConceptsJson: JSON.stringify(focusConcepts),
        assignment: fixture.assignment,
        sectionsJson: JSON.stringify(fixture.sections),
        closingJson: null,
        comparisonJson: null,
        realWorldJson: null,
        contentMd: sectionsToMarkdown(fixture.sections),
        status: "ready",
        model: "demo-fixture",
        inputTokens: 1200,
        outputTokens: 900,
      })
      .run();

    for (const question of storeQuestions(fixture.questions)) {
      tx.insert(questions)
        .values({ ...question, lessonId })
        .run();
    }
  });
});

console.log(topicId);
