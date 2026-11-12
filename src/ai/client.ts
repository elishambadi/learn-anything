import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { db } from "@/db/client";
import { llmCalls } from "@/db/schema";
import { env, modelForMode } from "@/env";

export const TOOL_NAME = "emit_course_json";
const MAX_ATTEMPTS = 4;

export type SystemBlock = { text: string; cache?: boolean };

export type StructuredCallOptions<T extends z.ZodType> = {
  purpose: string;
  promptVersion: string;
  schema: T;
  system: string | SystemBlock[];
  user: string;
  mode?: "normal" | "deep";
  maxTokens?: number;
  topicId?: string | null;
  jobId?: string | null;
  /** Skip native structured outputs and use the forced-tool fallback. */
  forceTool?: boolean;
};

export type StructuredCallResult<T> = {
  data: T;
  raw: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
};

export class StructuredOutputError extends Error {
  readonly raw: string | undefined;

  constructor(message: string, raw?: string) {
    super(message);
    this.name = "StructuredOutputError";
    this.raw = raw;
  }
}

/** Auth, billing, or configuration failures: retrying cannot help. */
export class FatalAIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalAIError";
  }
}

export function isFatalApiFailure(
  status: number | undefined,
  message: string,
): boolean {
  if (status === 401 || status === 403 || status === 404) return true;
  return /credit balance|billing|invalid x-api-key|authentication|permission/i.test(
    message,
  );
}

function isFatalAIError(error: unknown): boolean {
  if (!(error instanceof Anthropic.APIError)) return false;
  return isFatalApiFailure(error.status, error.message);
}

let cachedClient: Anthropic | null = null;
/** Flipped off the first time the account rejects native structured outputs. */
let nativeStructuredOutputs = true;

export function getAnthropicClient(): Anthropic {
  if (!env.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  if (!cachedClient) {
    cachedClient = new Anthropic({
      apiKey: env.anthropicApiKey,
      maxRetries: 0,
      ...(process.env.ANTHROPIC_BASE_URL
        ? { baseURL: process.env.ANTHROPIC_BASE_URL }
        : {}),
    });
  }
  return cachedClient;
}

function toSystemBlocks(
  system: string | SystemBlock[],
): Anthropic.TextBlockParam[] {
  const blocks: SystemBlock[] =
    typeof system === "string" ? [{ text: system }] : system;
  return blocks.map((block) => ({
    type: "text" as const,
    text: block.text,
    ...(block.cache
      ? { cache_control: { type: "ephemeral" as const } }
      : {}),
  }));
}

function retryableStatus(status: number | undefined): boolean {
  return (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 529
  );
}

function isRetryable(error: unknown): boolean {
  if (error instanceof StructuredOutputError) return false;
  if (error instanceof Anthropic.APIError) return retryableStatus(error.status);
  // Network / connection failures surface as plain Errors.
  if (error instanceof Error) {
    return /fetch|network|socket|ECONN|ETIMEDOUT|timeout/i.test(
      error.message,
    );
  }
  return false;
}

function isOutputConfigUnsupported(error: unknown): boolean {
  if (!(error instanceof Anthropic.APIError)) return false;
  if (error.status !== 400) return false;
  return /output_config|structured output|json_schema|not supported/i.test(
    error.message,
  );
}

function isGrammarTooLarge(error: unknown): boolean {
  if (!(error instanceof Anthropic.APIError)) return false;
  if (error.status !== 400) return false;
  return /compiled grammar is too large|simplify your tool schemas|too many strict tools/i.test(
    error.message,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  const base = 1000 * 2 ** (attempt - 1);
  return base + Math.floor(Math.random() * 400);
}

function logCall(params: {
  topicId?: string | null;
  jobId?: string | null;
  purpose: string;
  model: string;
  promptVersion: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
  latencyMs: number;
  stopReason?: string | null;
  ok: boolean;
  error?: string | null;
}): void {
  try {
    db.insert(llmCalls)
      .values({
        id: randomUUID(),
        topicId: params.topicId ?? null,
        jobId: params.jobId ?? null,
        purpose: params.purpose,
        model: params.model,
        promptVersion: params.promptVersion,
        inputTokens: params.usage?.inputTokens ?? 0,
        outputTokens: params.usage?.outputTokens ?? 0,
        cacheReadTokens: params.usage?.cacheReadTokens ?? 0,
        cacheWriteTokens: params.usage?.cacheWriteTokens ?? 0,
        latencyMs: params.latencyMs,
        stopReason: params.stopReason ?? null,
        ok: params.ok,
        error: params.error ?? null,
      })
      .run();
  } catch (error) {
    console.error("Failed to record llm_call", error);
  }
}

type RawCallOutcome<T> = {
  data: T;
  raw: string;
  message: Anthropic.Message;
  usage: StructuredCallResult<T>["usage"];
};

async function callNative<T extends z.ZodType>(
  opts: StructuredCallOptions<T>,
  model: string,
): Promise<RawCallOutcome<z.infer<T>>> {
  const format = zodOutputFormat(opts.schema);
  const message = await getAnthropicClient().messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4000,
    system: toSystemBlocks(opts.system),
    messages: [{ role: "user", content: opts.user }],
    output_config: { format },
  });

  const raw = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!raw) {
    throw new StructuredOutputError(
      `Model returned no text (stop_reason=${message.stop_reason ?? "unknown"}).`,
      undefined,
    );
  }

  let data: z.infer<T>;
  try {
    data = format.parse(raw) as z.infer<T>;
  } catch (error) {
    throw new StructuredOutputError(
      error instanceof Error ? error.message : String(error),
      raw,
    );
  }

  return { data, raw, message, usage: usageFrom(message) };
}

async function callTool<T extends z.ZodType>(
  opts: StructuredCallOptions<T>,
  model: string,
): Promise<RawCallOutcome<z.infer<T>>> {
  const format = zodOutputFormat(opts.schema);
  const message = await getAnthropicClient().messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4000,
    system: toSystemBlocks(opts.system),
    messages: [{ role: "user", content: opts.user }],
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Emit the requested structured object. Fill every required field exactly.",
        input_schema: format.schema as Anthropic.Tool.InputSchema,
        strict: false,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    throw new StructuredOutputError(
      `Model did not call ${TOOL_NAME} (stop_reason=${message.stop_reason ?? "unknown"}).`,
      text || undefined,
    );
  }

  const raw = JSON.stringify(toolUse.input);
  try {
    const data = opts.schema.parse(toolUse.input) as z.infer<T>;
    return { data, raw, message, usage: usageFrom(message) };
  } catch (error) {
    throw new StructuredOutputError(
      error instanceof Error ? error.message : String(error),
      raw,
    );
  }
}

function usageFrom(message: Anthropic.Message) {
  return {
    inputTokens: message.usage.input_tokens ?? 0,
    outputTokens: message.usage.output_tokens ?? 0,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

export async function callStructured<T extends z.ZodType>(
  opts: StructuredCallOptions<T>,
): Promise<StructuredCallResult<z.infer<T>>> {
  const model = modelForMode(opts.mode ?? "normal");
  let useNative = nativeStructuredOutputs && !opts.forceTool;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    const startedAt = Date.now();
    try {
      const outcome = useNative
        ? await callNative(opts, model)
        : await callTool(opts, model);
      logCall({
        topicId: opts.topicId,
        jobId: opts.jobId,
        purpose: opts.purpose,
        model,
        promptVersion: opts.promptVersion,
        usage: outcome.usage,
        latencyMs: Date.now() - startedAt,
        stopReason: outcome.message.stop_reason,
        ok: true,
      });
      return {
        data: outcome.data,
        raw: outcome.raw,
        model,
        usage: outcome.usage,
      };
    } catch (error) {
      lastError = error;

      if (isFatalAIError(error)) {
        logCall({
          topicId: opts.topicId,
          jobId: opts.jobId,
          purpose: opts.purpose,
          model,
          promptVersion: opts.promptVersion,
          latencyMs: Date.now() - startedAt,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new FatalAIError(
          error instanceof Error ? error.message : String(error),
        );
      }

      if (useNative && isOutputConfigUnsupported(error)) {
        console.warn(
          "Native structured outputs rejected; falling back to forced tool calls.",
        );
        nativeStructuredOutputs = false;
        useNative = false;
        attempt -= 1;
        continue;
      }

      if (useNative && isGrammarTooLarge(error)) {
        console.warn(
          "Structured output grammar too large; falling back to a non-strict forced tool call.",
        );
        nativeStructuredOutputs = false;
        useNative = false;
        attempt -= 1;
        continue;
      }

      logCall({
        topicId: opts.topicId,
        jobId: opts.jobId,
        purpose: opts.purpose,
        model,
        promptVersion: opts.promptVersion,
        latencyMs: Date.now() - startedAt,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });

      if (!isRetryable(error) || attempt >= MAX_ATTEMPTS) break;
      await sleep(backoffDelay(attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Structured call failed for an unknown reason.");
}

export function estimateCostUsd(usage: {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}): number {
  // Claude Haiku 4.5, USD per million tokens. Verify against current pricing.
  return (
    (usage.inputTokens / 1_000_000) * 1 +
    (usage.cacheReadTokens / 1_000_000) * 0.1 +
    (usage.outputTokens / 1_000_000) * 5
  );
}
