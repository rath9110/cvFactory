import Anthropic from "@anthropic-ai/sdk";

export const MODEL_ID = "claude-sonnet-5";

let cached: Anthropic | null = null;

export function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (cached) return cached;
  cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return cached;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Set LOG_TOKEN_USAGE=1 to print what each call actually cost in tokens.
 * `cache_read` should be non-zero on the second and later calls of a flow — if
 * it stays at 0, something is breaking the shared prefix and caching is off.
 */
function logUsage(usage: Anthropic.Usage): void {
  if (process.env.LOG_TOKEN_USAGE !== "1") return;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  console.log(
    `[tokens] in=${usage.input_tokens} cache_write=${cacheWrite} cache_read=${cacheRead} out=${usage.output_tokens}`
  );
}

export async function callJSON<T>(opts: {
  /**
   * Stable text every call in a flow sends identically — currently the master
   * profile. Placed first and marked for caching, so the second and later calls
   * in one application read it back at roughly a tenth of the input price
   * instead of paying for it again. Anything that varies per call must go in
   * `system` or `user`, after this block, or the cache never hits.
   */
  cachedContext?: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const system: Anthropic.TextBlockParam[] = opts.cachedContext
    ? [
        {
          type: "text",
          text: opts.cachedContext,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: opts.system },
      ]
    : [{ type: "text", text: opts.system }];

  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: opts.maxTokens ?? 4096,
    system,
    messages: [{ role: "user", content: opts.user }],
  });

  logUsage(response.usage);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text block in Anthropic response");
  }

  const raw = textBlock.text.trim();
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Could not locate JSON in model response");
  }
  const jsonText = raw.slice(jsonStart, jsonEnd + 1);
  return JSON.parse(jsonText) as T;
}
