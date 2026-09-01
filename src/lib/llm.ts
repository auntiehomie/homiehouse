/**
 * Multi-provider LLM helper with automatic fallback.
 *
 * All providers expose an OpenAI-compatible chat-completions API, so we use the
 * `openai` SDK with different baseURLs. Providers are tried in order until one
 * succeeds.
 *
 * Current provider selection (Sep 2026):
 * - OpenRouter paid models: Anthropic Haiku 4.5 (primary) + GLM 5.2 (backup)
 * - Gemini direct API: free tier, reliable, but reasoning model that sometimes
 *   puts text in the reasoning field instead of content
 * - OpenRouter free models: GLM 5.2 free, GPT-OSS, Gemma for redundancy
 *
 * Configure via env vars:
 *   OPENROUTER_API_KEY — https://openrouter.ai (paid + free models)
 *   GEMINI_API_KEY     — https://aistudio.google.com (free tier)
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

  // ─── OpenRouter — Anthropic Haiku + GLM 5.2 (paid, primary) ────────────────
  if (process.env.OPENROUTER_API_KEY) {
    const orClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // Claude Haiku 4.5 — fast, cheap ($0.001/$0.005 per 1M), excellent for structured JSON
    providers.push({
      name: 'openrouter-haiku',
      client: orClient,
      model: 'anthropic/claude-haiku-4.5',
      visionModel: 'anthropic/claude-haiku-4.5',
    });

    // GLM 5.2 — strong general-purpose, 256k context, tool support
    providers.push({
      name: 'openrouter-glm',
      client: orClient,
      model: 'z-ai/glm-5.2',
    });
  }

  // ─── Gemini direct API (free tier, reliable backup) ─────────────────────────
  // Placed after Haiku/GLM because Gemini 2.5 Flash is a reasoning model that
  // sometimes returns content in the reasoning field instead of content.
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

  // ─── OpenRouter free models (redundancy + rate-limit headroom) ──────────────
  if (process.env.OPENROUTER_API_KEY) {
    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // GLM 5.2 free — same model, free tier for rate-limit headroom
    providers.push({
      name: 'openrouter-glm-free',
      client,
      model: 'z-ai/glm-5.2:free',
    });

    // GPT-OSS 20B — OpenAI open weights (paid slug; the :free variant 404s)
    providers.push({
      name: 'openrouter-gpt-oss',
      client,
      model: 'openai/gpt-oss-20b',
    });

    // Gemma 4 31B — Google model via OpenRouter, 262k context, vision capable
    providers.push({
      name: 'openrouter-gemma',
      client,
      model: 'google/gemma-4-31b-it:free',
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
  /** Per-provider timeout in ms (default 8000). Pass a higher value for long-generation tasks like lesson creation. */
  timeoutMs?: number;
}

export interface LLMResponse {
  message: OpenAI.Chat.Completions.ChatCompletionMessage;
  provider: string;
}

/**
 * Run a chat completion, trying each configured provider in order until one
 * succeeds. Throws only if every provider fails (or none are configured).
 *
 * Some reasoning models (Gemini 2.5 Flash, GLM 5.2) return text in a
 * `reasoning` field with `content` set to null/undefined. We extract the
 * reasoning text into `content` so callers can always read `message.content`.
 */
export async function llmChat(params: LLMChatParams): Promise<LLMResponse> {
  const providers = getLLMProviders();
  if (providers.length === 0) {
    throw new Error('No LLM provider configured (set OPENROUTER_API_KEY or GEMINI_API_KEY)');
  }

  const errors: string[] = [];
  const perProviderTimeout = params.timeoutMs ?? 8000;
  for (const p of providers) {
    const controller = new AbortController();
    // Default 8s per-provider keeps total wait under Vercel's 60s limit.
    // Callers generating long content (lessons, plans) pass timeoutMs=55000.
    const timer = setTimeout(() => controller.abort(), perProviderTimeout);
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

      // Reasoning models (Gemini 2.5 Flash, GLM 5.2) sometimes put text in
      // `reasoning` with `content` as null. Extract it so callers always get
      // a usable string in `message.content`.
      if (!message.content && (message as any)?.reasoning) {
        message.content = (message as any).reasoning;
      }

      const hasContent = message.content ||
        (message as any)?.tool_calls?.length;
      if (!hasContent) throw new Error('empty content (model returned no text)');
      return { message, provider: p.name };
    } catch (err: any) {
      clearTimeout(timer);
      errors.push(`${p.name}: ${err?.message ?? 'unknown'}`);
    }
  }

  throw new Error(`All providers failed — ${errors.join(' | ')}`);
}
