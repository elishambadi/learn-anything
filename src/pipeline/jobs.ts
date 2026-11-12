import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { jobs } from "@/db/schema";

export async function withJob<T>(
  topicId: string,
  stage: string,
  fn: (jobId: string) => Promise<T>,
): Promise<T> {
  const jobId = randomUUID();
  db.insert(jobs)
    .values({ id: jobId, topicId, stage, status: "running" })
    .run();
  try {
    const result = await fn(jobId);
    db.update(jobs)
      .set({ status: "done", finishedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .run();
    return result;
  } catch (error) {
    db.update(jobs)
      .set({
        status: "failed",
        lastError: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
      .run();
    throw error;
  }
}
