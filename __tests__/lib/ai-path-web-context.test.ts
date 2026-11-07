import { getAIPathWebSources } from '@/lib/ai-path-web-context';

describe('AI path web research', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.TAVILY_API_KEY;
  afterEach(() => { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.TAVILY_API_KEY; else process.env.TAVILY_API_KEY = originalKey; });
  it('searches Wikipedia when broader web search is not configured', async () => {
    delete process.env.TAVILY_API_KEY;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ query: { search: [{ title: 'Intelligent agent', snippet: 'An <span>agent</span> observes.' }] } }) });
    expect(await getAIPathWebSources()).toEqual({ provider: 'wikipedia', sources: [{ title: 'Intelligent agent', url: 'https://en.wikipedia.org/wiki/Intelligent_agent', content: 'An agent observes.' }] });
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('en.wikipedia.org/w/api.php');
  });
  it('reports unavailable research when the public search fails', async () => {
    delete process.env.TAVILY_API_KEY;
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await getAIPathWebSources()).toEqual({ provider: null, sources: [] });
  });
});
