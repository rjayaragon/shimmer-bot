// One call to the Claude API per customer turn. Uses prompt caching so the long
// policy + price sheet is billed at the cheaper cached rate after the first call.
import { SYSTEM_PROMPT } from "./knowledge.mjs";

export async function askClaude(content) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-5",
      max_tokens: 900,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Claude API error: ${j.error?.message || r.status}`);
  return j.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}
