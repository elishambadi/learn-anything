import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db/client";
import {
  lessons,
  subtopics,
  topics,
  type SubtopicRow,
  type TopicRow,
} from "@/db/schema";
import { env } from "@/env";
import { FatalAIError } from "@/ai/client";
import {
  buildUnits,
  buildCourseOutline,
  loadAnalysis,
} from "@/pipeline/context";
import { mapLimit } from "@/pipeline/concurrency";
import { withJob } from "@/pipeline/jobs";
import { generateAnalysis } from "@/pipeline/stages/analyze";
import { generateSubtopics } from "@/pipeline/stages/decompose";
import { generateOutline } from "@/pipeline/stages/outline";
import { generateLesson } from "@/pipeline/stages/lesson";
import {
  countLessonsForUnit,
  getLessons,
  getSubtopics,
  getTopic,
  resetGeneratingLessons,
} from "@/db/queries";

export type PipelineStage =
  | "analyze"
  | "decompose"
  | "outline"
  | "lessons"
  | "done";

export type PipelineResult = {
  status: "ready" | "partial" | "failed";
  error: string | null;
};

export type PipelineProgress = {
  stage: PipelineStage;
  message: string;
};

const MAX_CONCURRENCY = 3;

function concurrency(): number {
  return Math.max(1, Math.min(env.concurrency, MAX_CONCURRENCY));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setTopicStatus(
  topicId: string,
  status: TopicRow["status"],
  error?: string | null,
): void {
  db.update(topics)
    .set({
      status,
      ...(error !== undefined ? { error } : {}),
      updatedAt: new Date(),
      heartbeatAt: new Date(),
    })
    .where(eq(topics.id, topicId))
    .run();
}

function startHeartbeat(topicId: string): () => void {
  const timer = setInterval(() => {
    try {
      db.update(topics)
        .set({ heartbeatAt: new Date() })
        .where(eq(topics.id, topicId))
        .run();
    } catch {
      // A missed heartbeat is recoverable; the boot sweep handles it.
    }
  }, 10_000);
  timer.unref?.();
  return () => clearInterval(timer);
}

function finalize(topicId: string, errors: string[]): PipelineResult {
  const all = getLessons(topicId);
  const ready = all.filter((lesson) => lesson.status === "ready").length;
  const failed = all.filter((lesson) => lesson.status === "failed").length;

  let status: PipelineResult["status"];
  if (all.length === 0) status = "failed";
  else if (ready === all.length && failed === 0 && errors.length === 0)
    status = "ready";
  else if (ready > 0) status = "partial";
  else status = "failed";

  const subs = getSubtopics(topicId);
  for (const subtopic of subs) {
    const unitLessons = all.filter(
      (lesson) => lesson.subtopicId === subtopic.id,
    );
    let subStatus: SubtopicRow["status"] = "pending";
    if (unitLessons.length > 0) {
      if (unitLessons.every((lesson) => lesson.status === "ready")) {
        subStatus = "ready";
      } else if (
        unitLessons.some((lesson) => lesson.status === "failed") ||
        unitLessons.some((lesson) => lesson.status === "pending")
      ) {
        subStatus = "failed";
      } else {
        subStatus = "generating";
      }
    }
    db.update(subtopics)
      .set({
        status: subStatus,
        ...(subStatus === "failed"
          ? { error: errors[0] ?? "One or more lessons failed." }
          : { error: null }),
      })
      .where(eq(subtopics.id, subtopic.id))
      .run();
  }

  setTopicStatus(topicId, status, errors[0] ?? null);
  return { status, error: errors[0] ?? null };
}

export async function runPipeline(
  topicId: string,
  options: { onProgress?: (progress: PipelineProgress) => void } = {},
): Promise<PipelineResult> {
  const report = (stage: PipelineStage, message: string) => {
    options.onProgress?.({ stage, message });
  };

  const topic = getTopic(topicId);
  if (!topic) throw new Error(`Topic ${topicId} not found.`);
  if (topic.status === "ready") return { status: "ready", error: null };

  resetGeneratingLessons(topicId);
  setTopicStatus(topicId, "generating", null);
  const stopHeartbeat = startHeartbeat(topicId);
  const errors: string[] = [];
  let fatalError: string | null = null;

  try {
    report("analyze", "Analyzing the topic");
    let analysis = loadAnalysis(topic);
    if (!analysis || (analysis.concepts ?? []).length < 3) {
      analysis = await withJob(topicId, "analyze", (jobId) =>
        generateAnalysis(topic, jobId),
      );
    }

    let subs = getSubtopics(topicId);
    if (topic.mode === "deep" && subs.length === 0) {
      report("decompose", "Breaking the topic into subtopics");
      subs = await withJob(topicId, "decompose", (jobId) =>
        generateSubtopics(topic, analysis!, jobId),
      );
    }

    const units = buildUnits(topic, analysis!, subs);

    report("outline", "Designing the lesson outline");
    await mapLimit(units, concurrency(), async (entry) => {
      if (fatalError) return;
      if (countLessonsForUnit(topicId, entry.subtopic?.id ?? null) > 0) return;
      try {
        await withJob(topicId, "outline", (jobId) =>
          generateOutline({
            topic,
            analysis: analysis!,
            unit: entry.unit,
            unitIndex: entry.index,
            unitCount: entry.count,
            subtopic: entry.subtopic,
            jobId,
          }),
        );
      } catch (error) {
        if (error instanceof FatalAIError) {
          fatalError = error.message;
          errors.push(`Generation stopped: ${error.message}`);
          return;
        }
        const message = `Outline failed for "${entry.unit.title}": ${errorMessage(error)}`;
        errors.push(message);
        if (entry.subtopic) {
          db.update(subtopics)
            .set({ status: "failed", error: message })
            .where(eq(subtopics.id, entry.subtopic.id))
            .run();
        }
      }
    });

    if (fatalError) return finalize(topicId, errors);

    const allLessons = getLessons(topicId);
    if (allLessons.length === 0) {
      errors.push(errors[0] ?? "No lessons were produced.");
      return finalize(topicId, errors);
    }

    const outline = buildCourseOutline(topic, subs, allLessons);
    const pending = allLessons.filter((lesson) => lesson.status !== "ready");

    report(
      "lessons",
      `Writing ${pending.length} lesson${pending.length === 1 ? "" : "s"}`,
    );

    await mapLimit(pending, concurrency(), async (lesson) => {
      if (fatalError) return;
      const entryIndex = lesson.subtopicId
        ? units.findIndex((entry) => entry.subtopic?.id === lesson.subtopicId)
        : 0;
      const entry = units[entryIndex] ?? units[0];
      const unitLessons = allLessons
        .filter((candidate) => candidate.subtopicId === lesson.subtopicId)
        .sort((a, b) => a.position - b.position);

      try {
        await withJob(topicId, `lesson:${lesson.id}`, (jobId) =>
          generateLesson({
            topic,
            analysis: analysis!,
            lesson,
            unit: entry.unit,
            unitIndex: entry.index,
            unitCount: entry.count,
            outline,
            lessonIndex: unitLessons.findIndex(
              (candidate) => candidate.id === lesson.id,
            ),
            lessonCount: unitLessons.length,
            jobId,
          }),
        );
      } catch (error) {
        if (error instanceof FatalAIError) {
          fatalError = error.message;
          return;
        }
        const message = `Lesson "${lesson.title}" failed: ${errorMessage(error)}`;
        errors.push(message);
        db.update(lessons)
          .set({ status: "failed", error: message })
          .where(eq(lessons.id, lesson.id))
          .run();
      }
    });

    if (fatalError) {
      const message = `Generation stopped: ${fatalError}`;
      errors.push(message);
      db.update(lessons)
        .set({ status: "failed", error: message })
        .where(
          and(eq(lessons.topicId, topicId), ne(lessons.status, "ready")),
        )
        .run();
    }

    return finalize(topicId, errors);
  } catch (error) {
    const message = errorMessage(error);
    setTopicStatus(topicId, "failed", message);
    return { status: "failed", error: message };
  } finally {
    stopHeartbeat();
    report("done", "Finished");
  }
}
