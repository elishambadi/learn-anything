import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;

export const topics = sqliteTable(
  "topics",
  {
    id: text("id").primaryKey(),
    prompt: text("prompt").notNull(),
    mode: text("mode", { enum: ["normal", "deep"] }).notNull(),
    status: text("status", {
      enum: ["queued", "generating", "ready", "partial", "failed"],
    })
      .notNull()
      .default("queued"),
    analysisJson: text("analysis_json"),
    error: text("error"),
    heartbeatAt: integer("heartbeat_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
  },
  (table) => [index("topics_created_idx").on(table.createdAt)],
);

export const subtopics = sqliteTable(
  "subtopics",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    objectivesJson: text("objectives_json").notNull(),
    status: text("status", {
      enum: ["pending", "generating", "ready", "failed"],
    })
      .notNull()
      .default("pending"),
    error: text("error"),
  },
  (table) => [
    index("subtopics_topic_idx").on(table.topicId),
    uniqueIndex("subtopics_topic_position_idx").on(
      table.topicId,
      table.position,
    ),
  ],
);

export const lessons = sqliteTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    subtopicId: text("subtopic_id").references(() => subtopics.id, {
      onDelete: "cascade",
    }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    objectivesJson: text("objectives_json").notNull(),
    hasSequence: integer("has_sequence", { mode: "boolean" })
      .notNull()
      .default(false),
    summary: text("summary"),
    heroQuery: text("hero_query"),
    coreConceptsJson: text("core_concepts_json"),
    sectionsJson: text("sections_json"),
    closingJson: text("closing_json"),
    comparisonJson: text("comparison_json"),
    realWorldJson: text("real_world_json"),
    contentMd: text("content_md"),
    assignment: text("assignment"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    status: text("status", {
      enum: ["pending", "generating", "ready", "failed"],
    })
      .notNull()
      .default("pending"),
    error: text("error"),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
  },
  (table) => [
    index("lessons_topic_idx").on(table.topicId),
    index("lessons_subtopic_idx").on(table.subtopicId),
  ],
);

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    type: text("type", {
      enum: ["true_false", "radio", "multi", "order"],
    }).notNull(),
    prompt: text("prompt").notNull(),
    optionsJson: text("options_json").notNull(),
    answerJson: text("answer_json").notNull(),
    explanation: text("explanation").notNull(),
    difficulty: text("difficulty", {
      enum: ["easy", "medium", "hard"],
    }).notNull(),
    placement: text("placement", { enum: ["inline", "final"] })
      .notNull()
      .default("final"),
  },
  (table) => [index("questions_lesson_idx").on(table.lessonId)],
);

export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
  },
  (table) => [
    index("attempts_topic_idx").on(table.topicId),
    index("attempts_lesson_idx").on(table.lessonId),
  ],
);

export const answers = sqliteTable(
  "answers",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    responseJson: text("response_json").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  },
  (table) => [index("answers_attempt_idx").on(table.attemptId)],
);

export const quizAttempts = sqliteTable(
  "quiz_attempts",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
  },
  (table) => [index("quiz_attempts_topic_idx").on(table.topicId)],
);

export const quizAnswers = sqliteTable(
  "quiz_answers",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    responseJson: text("response_json").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  },
  (table) => [index("quiz_answers_attempt_idx").on(table.attemptId)],
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    status: text("status", {
      enum: ["running", "done", "failed"],
    })
      .notNull()
      .default("running"),
    attempts: integer("attempts").notNull().default(1),
    lastError: text("last_error"),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("jobs_topic_idx").on(table.topicId)],
);

export const llmCalls = sqliteTable(
  "llm_calls",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id").references(() => topics.id, {
      onDelete: "cascade",
    }),
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    purpose: text("purpose").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    stopReason: text("stop_reason"),
    ok: integer("ok", { mode: "boolean" }).notNull().default(true),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now),
  },
  (table) => [
    index("llm_calls_topic_idx").on(table.topicId),
    index("llm_calls_created_idx").on(table.createdAt),
  ],
);

export type TopicRow = typeof topics.$inferSelect;
export type SubtopicRow = typeof subtopics.$inferSelect;
export type LessonRow = typeof lessons.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type AttemptRow = typeof attempts.$inferSelect;
export type AnswerRow = typeof answers.$inferSelect;
export type QuizAttemptRow = typeof quizAttempts.$inferSelect;
export type QuizAnswerRow = typeof quizAnswers.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type LlmCallRow = typeof llmCalls.$inferSelect;
