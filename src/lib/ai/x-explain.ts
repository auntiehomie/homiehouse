/**
 * Plain-language explainer for X (Twitter) posts.
 *
 * The @homiehouselol X agent's core job: take a dense, jargon-heavy, or just
 * confusing post and rewrite it so a normal person gets it. Uses the free LLM
 * stack (llmChat) so this costs nothing per call — the real cost on the X side
 * is the API reads/posts (see x-budget.ts), not the language model.
 */

import Anthropic from '@anthropic-ai/sdk';
import { llmChat } from '@/lib/llm';
import { HOMIE_VOICE } from '@/lib/ai/persona';

const EXPLAIN_SYSTEM = `${HOMIE_VOICE}

RIGHT NOW: someone pointed you at a confusing, jargon-heavy, or overly-clever X post and wants it in plain language.

- Translate it so a regular person actually gets it. Explain any jargon in simple words as you go.
- Lead with what it MEANS. No "this post is saying..." or "basically this is about..." preamble — just say the plain version.
- Keep your voice (warm, plainspoken), but clarity comes first here — go light on jokes.
- Don't add hot takes or your own opinion unless it genuinely helps understanding.
- If the post is already clear, or it's just vibes/noise with nothing to explain, say that plainly instead of inventing meaning.
- Fit it in one tweet: under 280 characters.`;

/**
 * Turn an X post into a plain-language explanation. Returns '' for empty input.
 * Never throws — returns '' on any LLM failure so callers can skip gracefully.
 */
export async function explainXPost(
  postText: string,
  opts: { author?: string } = {}
): Promise<string> {
  const clean = (postText || '').trim();
  if (!clean) return '';

  const user = `Explain this X post in plain language${opts.author ? ` (posted by @${opts.author})` : ''}:\n\n"${clean.slice(0, 1500)}"`;
  const clip = (s: string) => s.trim().replace(/^["']|["']$/g, '').slice(0, 280).trim();

  // Free stack first (zero cost). The homie voice explainer is quality-sensitive
  // and low-volume, so fall back to Claude when the free providers are down/rate
  // limited — otherwise a flaky free stack silently returns no explanation.
  try {
    const { message } = await llmChat({
      messages: [
        { role: 'system', content: EXPLAIN_SYSTEM },
        { role: 'user', content: user },
      ],
      maxTokens: 160,
      temperature: 0.5,
    });
    const out = clip(message.content || '');
    if (out) return out;
  } catch (err: any) {
    console.warn('[x-explain] free stack failed, trying Claude:', err?.message);
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const res = await anthropic.messages.create({
        model: process.env.X_EXPLAIN_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 160,
        temperature: 0.5,
        system: EXPLAIN_SYSTEM,
        messages: [{ role: 'user', content: user }],
      });
      const block = res.content[0];
      if (block?.type === 'text') return clip(block.text);
    } catch (err: any) {
      console.error('[x-explain] Claude fallback failed:', err?.message);
    }
  }

  return '';
}
