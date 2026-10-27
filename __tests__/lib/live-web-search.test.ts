import { searchTopicWeb } from '@/lib/ai/news';

describe('Ask Homie Brave web search', () => {
  const originalApiKey = process.env.BRAVE_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.BRAVE_API_KEY;
    else process.env.BRAVE_API_KEY = originalApiKey;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('retrieves grounded page excerpts and source URLs from Brave', async () => {
    process.env.BRAVE_API_KEY = 'test-brave-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        grounding: {
          generic: [{
            url: 'https://example.org/article',
            title: 'Example Article',
            snippets: ['A relevant excerpt.'],
          }],
        },
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(searchTopicWeb('Explain this cast about decentralized identity')).resolves.toEqual({
      summary: 'Example Article (https://example.org/article)\nA relevant excerpt.',
      citations: ['https://example.org/article'],
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(requestUrl.toString()).toContain('https://api.search.brave.com/res/v1/llm/context?');
    expect(requestUrl.searchParams.get('q')).toBe('Explain this cast about decentralized identity');
    expect(requestInit.headers).toMatchObject({ 'X-Subscription-Token': 'test-brave-key' });
  });
});
