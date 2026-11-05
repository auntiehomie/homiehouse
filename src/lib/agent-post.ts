import Anthropic from '@anthropic-ai/sdk';
import { llmChat } from '@/lib/llm';
import { createApiLogger } from '@/lib/logger';
import type { PostMode } from '@/lib/ai/persona';

const logger = createApiLogger('/agent-post');

export function contentWords(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 3));
}

export function similarity(a: string, b: string): number {
  const x = contentWords(a);
  const y = contentWords(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

export function tooSimilar(text: string, recentTexts: string[], threshold = 0.4): boolean {
  return recentTexts.some((r) => similarity(text, r) >= threshold);
}

/**
 * Detect common chain-of-thought / drafting artifacts before text can reach a
 * public feed. This intentionally targets explicit reasoning headers and
 * first-person drafting notes rather than ordinary explanatory language.
 */
export function isInternalReasoningOutput(text: string): boolean {
  const value = text.trim();
  if (!value) return false;

  return [
    /^\s*(?:<\/?(?:think|analysis|reasoning)>|\*\*(?:analysis|reasoning)\*\*)/i,
    /^\s*(?:analysis|reasoning|chain of thought|internal reasoning|private notes)\s*[:—-]/i,
    /^\s*(?:let me think(?: this through)?|let's think(?: this through)?|i need to (?:answer|respond|write|draft)|we need to (?:answer|respond|write|draft)|the user (?:asks|wants|is asking)|the prompt asks)\b/i,
    /<\/?(?:think|analysis|reasoning)>/i,
  ].some((pattern) => pattern.test(value));
}

export function cleanPost(text: string, maxLen = 280): string {
  return text.trim().replace(/^['"]|['"]$/g, '').slice(0, maxLen).trim();
}

export function splitThreadCasts(content: string): string[] {
  const parts = content.split(/\n?\n?---\n?\n?/);
  if (parts.length < 2) return [content];
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Generate a post with Anthropic first and the configured free-provider stack as fallback. */
export async function writeAgentPost(
  system: string,
  instruction: string,
  options: { maxLen?: number; model?: string } = {},
): Promise<string> {
  const maxLen = options.maxLen ?? 280;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const model = options.model || process.env.AGENT_POST_MODEL || 'claude-haiku-4-5-20251001';
      const res = await anthropic.messages.create({
        model,
        max_tokens: 800,
        temperature: 0.85,
        system: `${system}\n\nDo any needed reasoning privately. Return only the final publish-ready post. Never include chain-of-thought, analysis, planning notes, draft labels, or a preface.`,
        messages: [{ role: 'user', content: `${instruction}\n\nOutput only the final post text; do not show reasoning or drafting notes.` }],
      });
      const block = res.content[0];
      if (block?.type === 'text' && block.text.trim()) {
        if (isInternalReasoningOutput(block.text)) {
          throw new Error('model returned internal reasoning instead of a publishable post');
        }
        return cleanPost(block.text, maxLen);
      }
      throw new Error('empty Anthropic response');
    } catch (err: any) {
      logger.warn('Anthropic post failed, using free providers', err);
    }
  }

  const { message } = await llmChat({
    messages: [
      { role: 'system', content: `${system}\n\nDo any needed reasoning privately. Return only the final publish-ready post. Never include chain-of-thought, analysis, planning notes, draft labels, or a preface.` },
      { role: 'user', content: `${instruction}\n\nOutput only the final post text; do not show reasoning or drafting notes.` },
    ],
    maxTokens: 800,
    temperature: 0.85,
  });
  const content = message.content || '';
  if (isInternalReasoningOutput(content)) {
    throw new Error('model returned internal reasoning instead of a publishable post');
  }
  return cleanPost(content, maxLen);
}

export type { PostMode };
