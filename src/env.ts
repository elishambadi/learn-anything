import { config } from "dotenv";

// The CLI runs outside Next, so load the same files Next does.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
  modelDeep: process.env.MODEL_DEEP ?? "",
  concurrency: intFromEnv("AI_CONCURRENCY", 3),
  databaseUrl: process.env.DATABASE_URL ?? "./data/learn.db",
};

export function modelForMode(mode: "normal" | "deep"): string {
  if (mode === "deep" && env.modelDeep) return env.modelDeep;
  return env.model;
}
