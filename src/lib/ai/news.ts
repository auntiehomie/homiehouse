/**
 * Live crypto news lookup for the @thehomie posting cron.
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

export interface TopicWebContext {
  summary: string;
  citations: string[];
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

/**
 * Search the wider web for a cast topic and return a compact sourced brief.
 * This is separate from fetchCryptoNews, which always searches for a general
 * recent crypto headline. Mention replies should search the topic they were
 * asked about and retain Perplexity's actual citation URLs.
 */
export async function searchTopicWeb(query: string): Promise<TopicWebContext | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  const cleanQuery = query.trim().slice(0, 700);
  if (!apiKey || cleanQuery.length < 5) return null;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'Research the cast topic using current web sources. Return a concise factual brief that distinguishes established facts from claims or uncertainty. Do not invent URLs or sources.',
          },
          {
            role: 'user',
            content: `Find useful web context for this Farcaster topic. Focus on the entities and question in the text; return at most 3 short factual sentences.\n\n${cleanQuery}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 350,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn('[news] Perplexity topic search failed:', response.status);
      return null;
    }

    const data = await response.json();
    const summary = String(data?.choices?.[0]?.message?.content ?? '').trim().slice(0, 1200);
    const citations = Array.isArray(data?.citations)
      ? data.citations.filter((url: unknown) => typeof url === 'string' && /^https?:\/\//i.test(url)).slice(0, 4)
      : [];
    if (!summary || summary.toLowerCase() === 'no results') return null;
    return { summary, citations };
  } catch (error) {
    console.warn('[news] topic web search unavailable:', (error as Error).message);
    return null;
  }
}
