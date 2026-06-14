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

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: 'groq',
      client: new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      }),
      model: 'llama-3.3-70b-versatile',
      visionModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    });
  }

  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: 'gemini',
      client: new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      }),
      model: 'gemini-2.0-flash',
      visionModel: 'gemini-2.0-flash',
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: 'openrouter',
      client: new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      }),
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      visionModel: 'meta-llama/llama-3.2-11b-vision-instruct:free',
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

  let lastError: any;
  for (const p of providers) {
    try {
      const response = await p.client.chat.completions.create({
        model: params.vision ? (p.visionModel ?? p.model) : p.model,
        messages: params.messages,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        ...(params.tools ? { tools: params.tools, tool_choice: params.toolChoice ?? 'auto' } : {}),
      });
      const message = response.choices[0]?.message;
      if (!message) throw new Error('empty response');
      return { message, provider: p.name };
    } catch (err: any) {
      console.error(`[llm] provider ${p.name} failed: ${err?.message}`);
      lastError = err;
    }
  }

  throw lastError ?? new Error('All LLM providers failed');
}
