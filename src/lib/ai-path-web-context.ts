/** Public web search enriches AI paths; unavailable research is not fabricated. */
export type AIPathWebSource = { title: string; url: string; content: string };
export type AIPathWebResearch = { provider: 'tavily' | 'wikipedia' | null; sources: AIPathWebSource[] };

export async function getAIPathWebSources(): Promise<AIPathWebResearch> {
  if (process.env.TAVILY_API_KEY) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: 'AI agents language model fundamentals evaluation safety agentic systems', max_results: 4, search_depth: 'basic' }),
        signal: controller.signal,
      });
      if (response.ok) {
        const result = await response.json();
        const sources: AIPathWebSource[] = Array.isArray(result?.results) ? result.results.slice(0, 4).flatMap((item: unknown): AIPathWebSource[] => {
          if (!item || typeof item !== 'object') return [];
          const value = item as Record<string, unknown>;
          if (typeof value.title !== 'string' || typeof value.url !== 'string' || typeof value.content !== 'string') return [];
          try {
            const url = new URL(value.url);
            if (url.protocol !== 'https:' || url.username || url.password) return [];
            return [{ title: value.title.slice(0, 180), url: url.href, content: value.content.slice(0, 700) }];
          } catch { return []; }
        }) : [];
        if (sources.length) return { provider: 'tavily', sources };
      }
    } catch { /* Use the public encyclopedia search below. */ }
    finally { clearTimeout(timeout); }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const query = new URLSearchParams({ action: 'query', list: 'search', srsearch: 'artificial intelligence agent language model', srlimit: '4', format: 'json', utf8: '1' });
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${query}`, { headers: { 'User-Agent': 'Homiehouse/1.0 (https://homiehouse.app)' }, signal: controller.signal });
    if (!response.ok) return { provider: null, sources: [] };
    const result = await response.json();
    const hits = Array.isArray(result?.query?.search) ? result.query.search : [];
    const sources: AIPathWebSource[] = hits.slice(0, 4).flatMap((item: unknown): AIPathWebSource[] => {
      if (!item || typeof item !== 'object') return [];
      const value = item as Record<string, unknown>;
      if (typeof value.title !== 'string' || typeof value.snippet !== 'string') return [];
      return [{ title: value.title.slice(0, 180), url: `https://en.wikipedia.org/wiki/${encodeURIComponent(value.title.replace(/ /g, '_'))}`, content: value.snippet.replace(/<[^>]*>/g, '').slice(0, 700) }];
    });
    return { provider: sources.length ? 'wikipedia' : null, sources };
  } catch { return { provider: null, sources: [] }; }
  finally { clearTimeout(timeout); }
}
