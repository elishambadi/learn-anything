import type { z } from "zod";
import {
  callStructured,
  StructuredOutputError,
  type StructuredCallOptions,
  type StructuredCallResult,
} from "./client";

export type RepairOptions<T extends z.ZodType> = StructuredCallOptions<T> & {
  /**
   * Runs after schema validation. Return human-readable problems; an empty
   * array means the output is acceptable.
   */
  check?: (data: z.infer<T>) => string[];
  /**
   * After the final repair, decide whether the remaining problems are
   * acceptable. Used for prose-length warnings that should not sink an
   * otherwise valid lesson. Defaults to rejecting every remaining problem.
   */
  allowRemaining?: (errors: string[]) => boolean;
  /** Repair attempts after the first call. Defaults to 1. */
  maxRepairs?: number;
};

function repairPrompt(
  originalUser: string,
  errors: string[],
  previousOutput: string,
): string {
  return [
    originalUser,
    "",
    "---",
    "Your previous response was rejected by an automated validator.",
    "",
    "Problems:",
    ...errors.map((error) => `- ${error}`),
    "",
    "Previous response:",
    "```json",
    previousOutput.slice(0, 12_000),
    "```",
    "",
    "Return a complete, corrected object. Do not explain; emit only the structured object.",
  ].join("\n");
}

/**
 * One model call plus focused repairs. Returns the accepted data or throws.
 * Lessons opt into a second repair because a six-question quiz can have more
 * than one independent validator failure.
 */
export async function callWithRepair<T extends z.ZodType>(
  opts: RepairOptions<T>,
): Promise<StructuredCallResult<z.infer<T>>> {
  let errors: string[] = [];
  let previous = "";

  try {
    const first = await callStructured(opts);
    errors = opts.check?.(first.data) ?? [];
    if (errors.length === 0) return first;
    previous = first.raw;
  } catch (error) {
    if (!(error instanceof StructuredOutputError)) throw error;
    errors = [error.message];
    previous = error.raw ?? "";
  }

  console.warn(`Repairing ${opts.purpose}: ${errors.join("; ")}`);

  const maxRepairs = Math.max(1, opts.maxRepairs ?? 1);

  for (let attempt = 1; attempt <= maxRepairs; attempt += 1) {
    try {
      const repaired = await callStructured({
        ...opts,
        purpose: `${opts.purpose}.repair`,
        forceTool: true,
        user: repairPrompt(opts.user, errors, previous),
      });

      const remaining = opts.check?.(repaired.data) ?? [];
      if (remaining.length === 0) return repaired;

      if (attempt === maxRepairs) {
        if (opts.allowRemaining?.(remaining) ?? false) return repaired;
        throw new StructuredOutputError(
          `Output still failed validation after ${maxRepairs} repair${
            maxRepairs === 1 ? "" : "s"
          }: ${remaining.join("; ")}`,
          repaired.raw,
        );
      }

      errors = remaining;
      previous = repaired.raw;
    } catch (error) {
      if (!(error instanceof StructuredOutputError)) throw error;
      if (attempt === maxRepairs) throw error;
      errors = [error.message];
      previous = error.raw ?? previous;
    }
  }

  throw new StructuredOutputError(
    "Output could not be repaired.",
    previous,
  );
}
