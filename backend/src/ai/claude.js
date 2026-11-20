import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// Every AI feature in CoRide has a rule-based fallback, so the app works the
// same without a key; Claude only makes the answers smarter.
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

let client = null;
export const aiEnabled = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const getClient = () => {
  if (!aiEnabled()) return null;
  client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 });
  return client;
};

/**
 * Asks Claude for JSON matching `schema` (a zod object). Returns the parsed
 * object, or null when AI is off, the request fails, or the model declines,
 * so callers can fall back to their rule-based answer.
 */
export async function askStructured({ system, prompt, schema, maxTokens = 1024 }) {
  const c = getClient();
  if (!c) return null;
  try {
    const response = await c.messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      // Short extraction/classification tasks: low effort keeps them fast.
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") return null;
    return response.parsed_output ?? null;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) console.error("[ai] Invalid Anthropic credentials");
    else if (error instanceof Anthropic.RateLimitError) console.error("[ai] Rate limited");
    else if (error instanceof Anthropic.APIError) console.error(`[ai] API error ${error.status}: ${error.message}`);
    else console.error("[ai] Request failed:", error.message);
    return null;
  }
}
