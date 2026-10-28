/**
 * Live crypto news lookup for the @thehomie posting cron.
 *
 * `fetchCryptoNews` uses Perplexity for the autonomous poster's crypto-news
 * item. `searchTopicWeb` uses Brave's LLM Context endpoint for Ask Homie and
 * mention replies. Brave retrieves independent web sources; the configured
 * model then explains them alongside Hypersnap cast context.
 *
 * Fully optional: if BRAVE_API_KEY isn't set, callers should treat a
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

interface BraveContextResponse {
  grounding?: {
    generic?: Array<{
      url?: unknown;
      title?: unknown;
      snippets?: unknown;
    }>;
  };
}

interface TavilySearchResponse {
  answer?: unknown;
  results?: Array<{ url?: unknown; title?: unknown; content?: unknown }>;
}

/** Brave is preferred; support Tavily as a fallback for existing deployments. */
export function isTopicWebSearchConfigured(): boolean {
  return Boolean(process.env.BRAVE_API_KEY || process.env.TAVILY_API_KEY || process.env.TAVILT_API_KEY);
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
 * Search the wider web for a question or cast topic and return grounded text
 * with the source URLs Brave used to retrieve it.
 */
export async function searchTopicWeb(query: string): Promise<TopicWebContext | null> {
  const apiKey = process.env.BRAVE_API_KEY;
  const tavilyApiKey = process.env.TAVILY_API_KEY || process.env.TAVILT_API_KEY;
  const cleanQuery = query.trim().slice(0, 600);
  if ((!apiKey && !tavilyApiKey) || cleanQuery.length < 5) return null;

  if (apiKey) try {
    const endpoint = new URL('https://api.search.brave.com/res/v1/llm/context');
    endpoint.searchParams.set('q', cleanQuery);
    endpoint.searchParams.set('count', '6');
    endpoint.searchParams.set('maximum_number_of_urls', '6');
    endpoint.searchParams.set('maximum_number_of_tokens', '4096');
    endpoint.searchParams.set('maximum_number_of_snippets', '18');
    endpoint.searchParams.set('context_threshold_mode', 'balanced');
    endpoint.searchParams.set('safesearch', 'moderate');

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
      signal: AbortSignal.timeout(12000),
    });

    if (response.ok) {
      const data = await response.json() as BraveContextResponse;
      const sources = Array.isArray(data?.grounding?.generic) ? data.grounding.generic : [];
      const citations: string[] = [];
      const excerpts = sources.flatMap((source) => {
        const url = typeof source?.url === 'string' && /^https?:\/\//i.test(source.url) ? source.url : '';
        if (!url) return [];
        citations.push(url);
        const snippets = Array.isArray(source?.snippets)
          ? source.snippets.filter((snippet: unknown) => typeof snippet === 'string').slice(0, 3)
          : [];
        if (!snippets.length) return [];
        return [`${String(source.title || url).slice(0, 180)} (${url})\n${snippets.join('\n')}`];
      });
      const summary = excerpts.join('\n\n').slice(0, 7000);
      if (summary) return { summary, citations: [...new Set(citations)].slice(0, 6) };
    }
  } catch (error) {
    console.warn('[news] Brave topic search unavailable:', (error as Error).message);
  }

  // Several existing Vercel deployments have the Tavily variable configured;
  // accept the historical TAVILT_API_KEY spelling as well as the documented
  // TAVILY_API_KEY so the fallback works without rotating a secret.
  if (tavilyApiKey) try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tavilyApiKey}`,
      },
      body: JSON.stringify({ query: cleanQuery, search_depth: 'basic', max_results: 6 }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      console.warn('[news] Tavily topic search failed:', response.status);
      return null;
    }
    const data = await response.json() as TavilySearchResponse;
    const results = Array.isArray(data?.results) ? data.results : [];
    const citations: string[] = [];
    const excerpts = results.flatMap((result) => {
      const url = typeof result?.url === 'string' && /^https?:\/\//i.test(result.url) ? result.url : '';
      const content = typeof result?.content === 'string' ? result.content.trim() : '';
      if (!url || !content) return [];
      citations.push(url);
      return [`${String(result.title || url).slice(0, 180)} (${url})\n${content.slice(0, 1400)}`];
    });
    const summary = excerpts.join('\n\n').slice(0, 7000);
    if (!summary) return null;
    return { summary, citations: [...new Set(citations)].slice(0, 6) };
  } catch (error) {
    console.warn('[news] Tavily topic search unavailable:', (error as Error).message);
  }

  return null;
}

/** Format live web results as source-grounded context for Ask Homie's model. */
export function formatLiveWebContext(context: TopicWebContext): string {
  const citations = context.citations.length
    ? context.citations.map((url, index) => `[${index + 1}] ${url}`).join('\n')
    : 'No citation URLs were returned.';

  return `\n\n[LIVE WEB SEARCH]\nThis is retrieved web material and may be incomplete or wrong. Use it as evidence, distinguish verified facts from uncertainty, and cite claims from it using the exact source URLs below. Do not invent citations.\n${context.summary}\nSources:\n${citations}\n[END LIVE WEB SEARCH]\n`;
}
