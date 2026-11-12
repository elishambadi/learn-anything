import { inArray, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { topics } from "@/db/schema";
import { env } from "@/env";
import { resetGeneratingLessons } from "@/db/queries";
import { runPipeline, type PipelineResult } from "./run";

type WorkerState = {
  running: Map<string, Promise<PipelineResult>>;
};

const globalForWorker = globalThis as unknown as {
  __learnAnythingWorker?: WorkerState;
};

function state(): WorkerState {
  if (!globalForWorker.__learnAnythingWorker) {
    globalForWorker.__learnAnythingWorker = { running: new Map() };
  }
  return globalForWorker.__learnAnythingWorker;
}

/**
 * Kick off a course in the current process. Fire-and-forget by design: the
 * caller returns an id immediately and the UI polls progress.
 */
export function enqueueTopic(topicId: string): boolean {
  const worker = state();
  if (worker.running.has(topicId)) return false;

  const promise = runPipeline(topicId)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      try {
        db.update(topics)
          .set({ status: "failed", error: message, updatedAt: new Date() })
          .where(eq(topics.id, topicId))
          .run();
      } catch {
        // Nothing useful left to do; recovery will retry on next boot.
      }
      return { status: "failed" as const, error: message };
    })
    .finally(() => {
      worker.running.delete(topicId);
    });

  worker.running.set(topicId, promise);
  return true;
}

export function isTopicRunning(topicId: string): boolean {
  return state().running.has(topicId);
}

/**
 * On boot, pick up work that a killed process left behind. This app assumes a
 * single long-lived Node process, so every unfinished course is orphaned at
 * boot: there is no other worker that could still own it. Enqueue them all.
 */
export async function recoverStaleTopics(): Promise<void> {
  if (!env.anthropicApiKey) {
    console.warn(
      "Skipping pipeline recovery: ANTHROPIC_API_KEY is not configured.",
    );
    return;
  }

  const candidates = db
    .select()
    .from(topics)
    .where(inArray(topics.status, ["queued", "generating"]))
    .all();

  for (const topic of candidates) {
    resetGeneratingLessons(topic.id);
    console.info(`Recovering unfinished course ${topic.id} (${topic.prompt})`);
    enqueueTopic(topic.id);
  }
}

/** Await all in-flight work. Used by the CLI and graceful shutdown. */
export async function drainPipeline(): Promise<void> {
  await Promise.allSettled([...state().running.values()]);
}
