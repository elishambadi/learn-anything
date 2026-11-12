import { getAnthropicClient } from "@/ai/client";
import { env } from "@/env";

async function main() {
  const client = getAnthropicClient();
  const available: string[] = [];
  for await (const model of client.models.list()) {
    available.push(model.id);
    const marker = model.id === env.model ? "  <- ANTHROPIC_MODEL" : "";
    console.log(`${model.id}${marker}`);
  }
  console.log("");
  if (available.includes(env.model)) {
    console.log(`Configured model "${env.model}" is available.`);
    return;
  }

  // Anthropic aliases are valid for inference but are not always returned by
  // GET /v1/models. Resolve the alias explicitly before declaring failure.
  try {
    const resolved = await client.models.retrieve(env.model);
    console.log(
      `Configured alias "${env.model}" resolves to ${resolved.id} and is available.`,
    );
  } catch (error) {
    console.error(
      `Configured model "${env.model}" is not available: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
