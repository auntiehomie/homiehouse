/**
 * Multi-provider LLM helper with automatic fallback.
 *
 * All providers expose an OpenAI-compatible chat-completions API, so we use the
 * `openai` SDK with different baseURLs. Providers are tried in order until one
 * succeeds — this keeps the app working when a single free tier hits its daily
 * rate limit (e.g. Groq's 100k tokens/day).
 *
 * Configure via env vars (each is optional; order = priority):
 *   GROQ_API_KEY       — https://console.groq.com  (llama-3.3-70b-versatile)
 *   GEMINI_API_KEY     — https://aistudio.google.com (gemini-2.0-flash, generous free tier)
 *   OPENROUTER_API_KEY — https://openrouter.ai      (free llama models)
 *
 * Per the project's model policy we deliberately do NOT fall back to Claude or
 * OpenAI — only free, third-party-hosted open models.
 *
 * See docs/AI_PROVIDER_STRATEGY.md for the full policy, an audit of every AI
 * call site in the codebase (several don't go through this file and don't
 * follow this policy — that's documented there, not silently fixed here),
 * and when a paid-provider exception (Claude/OpenAI/Perplexity) is justified.
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

  // Cerebras — free tier, very fast inference.
  // 402 = billing/credits issue (model ID is valid, account needs credits)
  if (process.env.CEREBRAS_API_KEY) {
    const client = new OpenAI({
      apiKey: process.env.CEREBRAS_API_KEY,
      baseURL: 'https://api.cerebras.ai/v1',
    });
    providers.push({ name: 'cerebras', client, model: process.env.CEREBRAS_MODEL || 'gpt-oss-120b' });
  }

  if (process.env.GROQ_API_KEY) {
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    // Groq retired all Llama models (llama-3.1-8b-instant, llama-3.3-70b-versatile → 404).
    // Current production models: openai/gpt-oss-20b (fast) and openai/gpt-oss-120b (quality).
    providers.push({ name: 'groq-fast', client, model: 'openai/gpt-oss-20b' });
    providers.push({ name: 'groq', client, model: 'openai/gpt-oss-120b' });
  }

  if (process.env.GEMINI_API_KEY) {
    const client = new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
    // gemini-2.0-flash was retired (404). gemini-2.5-flash still works (429 = rate limited, not dead).
    providers.push({ name: 'gemini-flash', client, model: 'gemini-2.5-flash', visionModel: 'gemini-2.5-flash' });
    providers.push({ name: 'gemini', client, model: 'gemini-2.5-pro', visionModel: 'gemini-2.5-flash' });
  }

  if (process.env.OPENROUTER_API_KEY) {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
    // meta-llama/llama-3.3-70b-instruct:free was delisted (404 — paid only now).
    // Current free models with tool support (verified Aug 2026):
    //   z-ai/glm-5.2:free (256k ctx, text), openai/gpt-oss-20b:free (131k ctx, text),
    //   google/gemma-4-31b-it:free (262k ctx, vision), nvidia/nemotron-3-super-120b-a12b:free
    providers.push({ name: 'openrouter-gemma', client, model: 'google/gemma-4-26b-a4b-it:free' });
    providers.push({
      name: 'openrouter',
      client,
      model: 'z-ai/glm-5.2:free',
      visionModel: 'google/gemma-4-31b-it:free',
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
