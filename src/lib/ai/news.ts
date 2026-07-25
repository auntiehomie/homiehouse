/**
 * Live crypto news lookup for the @homiehouselol posting cron.
 *
 * Uses Perplexity's `sonar` model, which does its own web search, to surface
 * one specific, recent, real crypto news item the agent can react to —
 * distinct from `fetchTrendingFeed` in hypersnap.ts, which only sees what's
 * trending *on Farcaster*, not the wider web.
 *
 * Fully optional: if PERPLEXITY_API_KEY isn't set, callers should treat a
 * null return the same way they treat "no trend found" and fall back to
 * another post mode.
 */

export interface CryptoNewsItem {
  headline: string;
  summary: string;
  source?: string;
}

const NEWS_SYSTEM = `You are a crypto news lookup tool. Search the web for ONE specific, real crypto/web3/blockchain news story from the last 48 hours — something with a real headline and a real source, not a general trend.

Respond with ONLY a JSON object, no other text:
{"headline": "...", "summary": "one or two sentence factual summary", "source": "publication or site name"}

If you cannot find a genuine, verifiable recent story, respond with exactly: null`;

/**
 * Fetch one recent, real crypto news story via Perplexity's web-search-backed
 * sonar model. Returns null if PERPLEXITY_API_KEY is unset, the request
 * fails, or Perplexity couldn't find anything to report.
 */
export async function fetchCryptoNews(): Promise<CryptoNewsItem | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: NEWS_SYSTEM },
          { role: 'user', content: 'Find one recent crypto news story.' },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      console.warn('[news] Perplexity API error:', res.status);
      return null;
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!raw || raw.toLowerCase() === 'null') return null;

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed?.headline || !parsed?.summary) return null;

    return {
      headline: String(parsed.headline).slice(0, 200),
      summary: String(parsed.summary).slice(0, 400),
      source: parsed.source ? String(parsed.source).slice(0, 100) : undefined,
    };
  } catch (err: any) {
    console.warn('[news] fetchCryptoNews failed:', err?.message);
    return null;
  }
}
