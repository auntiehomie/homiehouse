/**
 * Multi-provider LLM helper with automatic fallback.
 *
 * All providers expose an OpenAI-compatible chat-completions API, so we use the
 * `openai` SDK with different baseURLs. Providers are tried in order until one
 * succeeds.
 *
 * Current provider selection (Aug 2026):
 * - Cerebras and Groq dropped: no more free tier (Cerebras 402, Groq delisted all free Llama models)
 * - Gemini direct API kept: generous free tier, fast, reliable
 * - OpenRouter free models: 4 diverse model families for redundancy + rate limit headroom
 *
 * Configure via env vars:
 *   GEMINI_API_KEY     — https://aistudio.google.com (free tier)
 *   OPENROUTER_API_KEY — https://openrouter.ai (free models)
 *
 * Per the project's model policy we deliberately do NOT fall back to Claude or
 * OpenAI paid — only free, open models.
 */

import OpenAI from 'openai';

export interface LLMProvider {
  name: string;
  client: OpenAI;
  /** Model id used for text generation */
  model: string;
  /** Vision-capable model id (falls back to `model` if not set) */
  visionModel?: string;
}

/** Build the ordered provider list from whichever API keys are configured. */
export function getLLMProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  // ─── Gemini direct API (fastest, Google infra, generous free tier) ───────────
  if (process.env.GEMINI_API_KEY) {
    const client = new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
    providers.push({
      name: 'gemini',
      client,
      model: 'gemini-2.5-flash',
      visionModel: 'gemini-2.5-flash',
    });
  }

  // ─── OpenRouter free models (diverse families for redundancy) ──────────────
  if (process.env.OPENROUTER_API_KEY) {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // GLM 5.2 — strong general-purpose model, 256k context, tool support
    providers.push({
      name: 'openrouter-glm',
      client,
      model: 'z-ai/glm-5.2:free',
    });

    // GPT-OSS 20B — OpenAI open weights, fast, 131k context
    providers.push({
      name: 'openrouter-gpt-oss',
      client,
      model: 'openai/gpt-oss-20b:free',
    });

    // Gemma 4 31B — Google model via OpenRouter, 262k context, vision capable
    providers.push({
      name: 'openrouter-gemma',
      client,
      model: 'google/gemma-4-31b-it:free',
      visionModel: 'google/gemma-4-31b-it:free',
    });

    // Nemotron 3 Super 120B — NVIDIA's large model, 262k context, deep reasoning
    providers.push({
      name: 'openrouter-nemotron',
      client,
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
    });
  }

  return providers;
}

export interface LLMChatParams {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  maxTokens?: number;
  temperature?: number;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  toolChoice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
  /** Use the provider's vision model instead of its text model */
  vision?: boolean;
}

export interface LLMResponse {
  message: OpenAI.Chat.Completions.ChatCompletionMessage;
  provider: string;
}

/**
 * Run a chat completion, trying each configured provider in order until one
 * succeeds. Throws only if every provider fails (or none are configured).
 */
export async function llmChat(params: LLMChatParams): Promise<LLMResponse> {
  const providers = getLLMProviders();
  if (providers.length === 0) {
    throw new Error('No LLM provider configured (set GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY)');
  }

  const errors: string[] = [];
  for (const p of providers) {
    const controller = new AbortController();
    // Agent tool loops and Vercel cold starts need a little more room than the
    // original 25s budget. Keep this bounded while increasing it by 1.5x.
    // 8s per-provider timeout — 6 providers × 8s = 48s worst case,
    // safely under Vercel's 60s function timeout.
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await p.client.chat.completions.create(
        {
          model: params.vision ? (p.visionModel ?? p.model) : p.model,
          messages: params.messages,
          max_tokens: params.maxTokens,
          temperature: params.temperature,
          ...(params.tools ? { tools: params.tools, tool_choice: params.toolChoice ?? 'auto' } : {}),
        },
        { signal: controller.signal },
      );
      clearTimeout(timer);
      const message = response.choices[0]?.message;
      if (!message) throw new Error('empty response');
      return { message, provider: p.name };
    } catch (err: any) {
      clearTimeout(timer);
      errors.push(`${p.name}: ${err?.message ?? 'unknown'}`);
    }
  }

  throw new Error(`All providers failed — ${errors.join(' | ')}`);
}
