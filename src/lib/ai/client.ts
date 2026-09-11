import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

// Provider-agnostic by design (AI SDK) — swap via AI_PROVIDER without
// touching the analyze/classify call sites. Defaults to Groq's free tier;
// set AI_PROVIDER=anthropic to use Claude once a paid key is available.
const provider = process.env.AI_PROVIDER ?? "groq";

function models(): { classifier: LanguageModel; analysis: LanguageModel } {
  if (provider === "anthropic") {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return {
      classifier: anthropic("claude-haiku-4-5-20251001"),
      analysis: anthropic("claude-sonnet-5"),
    };
  }

  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
  return {
    // Free-tier Groq models: a fast small model for the cheap classification
    // step, a larger model for the more demanding clause-by-clause analysis.
    // (llama-3.1-8b-instant / llama-3.3-70b-versatile were deprecated by
    // Groq on 2026-06-17 and shut down 2026-08-16 — these are Groq's
    // recommended replacements.)
    classifier: groq("openai/gpt-oss-20b"),
    analysis: groq("openai/gpt-oss-120b"),
  };
}

export const { classifier: classifierModel, analysis: analysisModel } = models();
