import Anthropic from "@anthropic-ai/sdk";

export const MODEL_ID = "claude-sonnet-4-6";

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

export async function callJSON<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

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
