export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  try {
    const { recoverStaleTopics } = await import("./src/pipeline/worker");
    await recoverStaleTopics();
  } catch (error) {
    console.error("Pipeline recovery failed", error);
  }
}
