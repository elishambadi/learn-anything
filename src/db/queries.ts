import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import {
  attempts,
  lessons,
  questions,
  quizAttempts,
  subtopics,
  topics,
  type LessonRow,
  type SubtopicRow,
  type TopicRow,
} from "./schema";

export function getTopic(id: string): TopicRow | undefined {
  return db.select().from(topics).where(eq(topics.id, id)).get();
}

export function getSubtopics(topicId: string): SubtopicRow[] {
  return db
    .select()
    .from(subtopics)
    .where(eq(subtopics.topicId, topicId))
    .orderBy(asc(subtopics.position))
    .all();
}

export function getLessons(topicId: string): LessonRow[] {
  return db
    .select()
    .from(lessons)
    .where(eq(lessons.topicId, topicId))
    .orderBy(asc(lessons.position))
    .all();
}

/** Lessons in true course order: subtopic order first, then lesson order. */
export function getOrderedLessons(topicId: string): LessonRow[] {
  const subs = getSubtopics(topicId);
  const rows = getLessons(topicId);
  if (subs.length === 0) return rows;
  const order = new Map(subs.map((sub, index) => [sub.id, index]));
  return [...rows].sort((a, b) => {
    const aUnit = a.subtopicId ? (order.get(a.subtopicId) ?? 0) : 0;
    const bUnit = b.subtopicId ? (order.get(b.subtopicId) ?? 0) : 0;
    return aUnit - bUnit || a.position - b.position;
  });
}

export function getLesson(id: string): LessonRow | undefined {
  return db.select().from(lessons).where(eq(lessons.id, id)).get();
}

export function getQuestions(lessonId: string) {
  return db
    .select()
    .from(questions)
    .where(eq(questions.lessonId, lessonId))
    .orderBy(asc(questions.position))
    .all();
}

export type TopicSummary = TopicRow & {
  lessonCount: number;
  readyCount: number;
  attemptCount: number;
  bestScore: number | null;
  scoreTotal: number | null;
};

export function listTopics(): TopicSummary[] {
  return db
    .select({
      id: topics.id,
      prompt: topics.prompt,
      mode: topics.mode,
      status: topics.status,
      analysisJson: topics.analysisJson,
      error: topics.error,
      heartbeatAt: topics.heartbeatAt,
      createdAt: topics.createdAt,
      updatedAt: topics.updatedAt,
      lessonCount: sql<number>`(select count(*) from lessons where lessons.topic_id = topics.id)`,
      readyCount: sql<number>`(select count(*) from lessons where lessons.topic_id = topics.id and lessons.status = 'ready')`,
      attemptCount: sql<number>`(select count(*) from attempts where attempts.topic_id = topics.id)`,
      bestScore: sql<number | null>`(select score from attempts where attempts.topic_id = topics.id order by (score * 1.0 / total) desc, submitted_at desc, id desc limit 1)`,
      scoreTotal: sql<number | null>`(select total from attempts where attempts.topic_id = topics.id order by (score * 1.0 / total) desc, submitted_at desc, id desc limit 1)`,
    })
    .from(topics)
    .orderBy(desc(topics.createdAt))
    .all() as TopicSummary[];
}

export type LessonAttemptSummary = {
  lessonId: string;
  attempts: number;
  bestScore: number;
  total: number;
  lastSubmittedAt: Date;
};

export function getAttemptSummaryByLesson(
  topicId: string,
): Map<string, LessonAttemptSummary> {
  const rows = db
    .select({
      lessonId: attempts.lessonId,
      attemptCount: sql<number>`count(*)`,
      bestScore: sql<number>`max(score)`,
      total: sql<number>`max(total)`,
      lastSubmittedAt: sql<number>`max(submitted_at)`,
    })
    .from(attempts)
    .where(eq(attempts.topicId, topicId))
    .groupBy(attempts.lessonId)
    .all();

  return new Map(
    rows.map((row) => [
      row.lessonId,
      {
        lessonId: row.lessonId,
        attempts: row.attemptCount,
        bestScore: row.bestScore,
        total: row.total,
        lastSubmittedAt: new Date(row.lastSubmittedAt),
      },
    ]),
  );
}

export function getNextLesson(
  topicId: string,
  lessonId: string,
): LessonRow | null {
  const ordered = getOrderedLessons(topicId);
  const index = ordered.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) return null;
  return ordered[index + 1] ?? null;
}

export type FinalQuizQuestion = {
  question: (typeof questions.$inferSelect);
  lessonId: string;
  lessonTitle: string;
};

/** Two questions per ready lesson, in course order. */
export function getFinalQuizQuestions(topicId: string): FinalQuizQuestion[] {
  const ordered = getOrderedLessons(topicId);
  const result: FinalQuizQuestion[] = [];
  for (const lesson of ordered) {
    if (lesson.status !== "ready") continue;
    const rows = getQuestions(lesson.id).slice(0, 2);
    for (const question of rows) {
      result.push({
        question,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
      });
    }
  }
  return result;
}

export function getFinalQuizSummary(topicId: string) {
  return db
    .select({
      attempts: sql<number>`count(*)`,
      bestScore: sql<number | null>`max(score)`,
      bestTotal: sql<number | null>`max(total)`,
      lastSubmittedAt: sql<number | null>`max(submitted_at)`,
    })
    .from(quizAttempts)
    .where(eq(quizAttempts.topicId, topicId))
    .get();
}

export function markLessonComplete(lessonId: string): boolean {
  const result = db
    .update(lessons)
    .set({ completedAt: new Date() })
    .where(eq(lessons.id, lessonId))
    .run();
  return result.changes > 0;
}

export function getTopicAttempts(topicId: string) {
  return db
    .select({
      id: attempts.id,
      lessonId: attempts.lessonId,
      lessonTitle: lessons.title,
      score: attempts.score,
      total: attempts.total,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .innerJoin(lessons, eq(lessons.id, attempts.lessonId))
    .where(eq(attempts.topicId, topicId))
    .orderBy(desc(attempts.submittedAt))
    .all();
}

export function deleteTopic(topicId: string): boolean {
  const result = db.delete(topics).where(eq(topics.id, topicId)).run();
  return result.changes > 0;
}

export function resetGeneratingLessons(topicId: string): void {
  db.update(lessons)
    .set({ status: "pending", error: null })
    .where(and(eq(lessons.topicId, topicId), eq(lessons.status, "generating")))
    .run();
}

export function countLessonsForUnit(
  topicId: string,
  subtopicId: string | null,
): number {
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(lessons)
    .where(
      subtopicId
        ? and(eq(lessons.topicId, topicId), eq(lessons.subtopicId, subtopicId))
        : and(eq(lessons.topicId, topicId), sql`${lessons.subtopicId} is null`),
    )
    .get();
  return row?.count ?? 0;
}
