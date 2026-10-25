import { NextRequest } from 'next/server';
import { POST, GET, PATCH } from '@/app/api/ask-homie/route';

var generateLearning = jest.fn();
jest.mock('@/lib/ai/conversation-learning', () => ({ generateConversationLearning: (...args: unknown[]) => generateLearning(...args) }));

var processRequest = jest.fn();
var getProfile = jest.fn();
var getStats = jest.fn();
var updateProfile = jest.fn();
var addCast = jest.fn();
var searchRelevantCasts = jest.fn();
var searchTopicWeb = jest.fn();

jest.mock('@/lib/ai/cast-research', () => ({
  searchRelevantCasts: (...args: unknown[]) => searchRelevantCasts(...args),
  shouldSearchLiveCasts: (question: string, intent?: string) =>
    intent === 'research' || (intent === 'auto' && /farcaster|hypersnap/i.test(question) && /cast|recent|latest|news|discussion|trending|sale|acquisition|verify|read/i.test(question)),
  requiresLiveCastEvidence: (question: string) => /recent|latest|news|sale|acquisition|verify/i.test(question),
  formatLiveCastContext: (research: { queries: string[]; casts: unknown[] }) =>
    `LIVE SEARCH ${research.queries.join(',')}: ${JSON.stringify(research.casts)}`,
}));
jest.mock('@/lib/ai/news', () => ({
  searchTopicWeb: (...args: unknown[]) => searchTopicWeb(...args),
  formatLiveWebContext: (research: { summary: string; citations: string[] }) =>
    `LIVE WEB ${research.summary} ${research.citations.join(' ')}`,
}));
jest.mock('@/lib/agent-context', () => ({
  shouldSearchWeb: (question: string) => question.includes('?'),
}));
jest.mock('@/lib/ai/sanitize-response', () => ({
  sanitizeAssistantResponse: (content: string) => content.includes('<function_calls>') ? 'Safe fallback' : content,
}));

jest.mock('@/lib/ai/agents', () => ({
  AgentOrchestrator: jest.fn().mockImplementation(() => ({ processRequest })),
}));
jest.mock('@/lib/ai/storage', () => {
  // Use getter-based properties so the mock vars are resolved lazily
  // (jest.mock factories run during import, before var assignments execute)
  return {
    UserProfileStorage: {
      getProfile: (...a: unknown[]) => getProfile(...a),
      getStats: (...a: unknown[]) => getStats(...a),
      updateProfile: (...a: unknown[]) => updateProfile(...a),
      addCast: (...a: unknown[]) => addCast(...a),
      addFeedback: jest.fn(),
    },
  };
});
jest.mock('@/lib/logger', () => ({
  createApiLogger: () => ({ start: jest.fn(), end: jest.fn(), info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => ({ success: true })) }));
jest.mock('@/lib/pro', () => ({ isProUser: jest.fn().mockResolvedValue(false) }));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((_error: unknown) => Response.json({ error: 'Internal error' }, { status: 500 })) }));

describe('/api/ask-homie', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProfile.mockReturnValue({});
    getStats.mockReturnValue({ casts: 0 });
    processRequest.mockResolvedValue({ content: 'Hello!', suggestions: [], role: 'assistant', metadata: {} });
    searchRelevantCasts.mockResolvedValue({ queries: ['farcaster acquisition'], casts: [] });
    searchTopicWeb.mockResolvedValue(null);
  });

  it('returns the assistant response for a valid request', async () => {
    const response = await POST(new NextRequest('http://localhost/api/ask-homie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ response: 'Hello!', agentRole: 'assistant' });
    expect(processRequest).toHaveBeenCalledWith('Hi', 'auto');
  });

  it('returns a handled error when the orchestrator fails', async () => {
    processRequest.mockRejectedValueOnce(new Error('provider unavailable'));
    const response = await POST(new NextRequest('http://localhost/api/ask-homie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Internal error' });
  });

  it('retrieves live Hypersnap cast evidence for auto-detected research questions', async () => {
    searchRelevantCasts.mockResolvedValueOnce({
      queries: ['farcaster acquisition'],
      casts: [{ username: 'alice', text: 'A cast discussing the topic' }],
    });
    const response = await POST(new NextRequest('http://localhost/api/ask-homie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What are recent Farcaster casts about the acquisition?' }],
      }),
    }));

    expect(response.status).toBe(200);
    expect(searchRelevantCasts).toHaveBeenCalledWith('What are recent Farcaster casts about the acquisition?');
    expect(processRequest).toHaveBeenCalledWith(
      expect.stringContaining('A cast discussing the topic'),
      'research',
    );
  });

  it('adds live web research and source links to Ask Homie answers', async () => {
    searchTopicWeb.mockResolvedValueOnce({
      summary: 'A current, sourced explanation.',
      citations: ['https://example.org/article'],
    });
    const response = await POST(new NextRequest('http://localhost/api/ask-homie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Explain this cast: what does it mean?' }],
        castContext: { text: 'A cast about decentralized identity.' },
      }),
    }));

    expect(searchTopicWeb).toHaveBeenCalledWith(expect.stringContaining('A cast about decentralized identity.'));
    expect(processRequest).toHaveBeenCalledWith(expect.stringContaining('LIVE WEB A current, sourced explanation.'), 'auto');
    await expect(response.json()).resolves.toMatchObject({
      metadata: { liveWebSearch: { provider: 'Brave Search', status: 'searched', citations: ['https://example.org/article'] } },
    });
  });

  it('passes the complete long cast context to Ask Homie for explanation', async () => {
    const longText = Array.from({ length: 180 }, (_, index) => `Section ${index + 1}: a detailed claim that needs plain-English context.`).join('\n\n');
    const response = await POST(new NextRequest('http://localhost/api/ask-homie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Can you explain this cast in plain English?' }],
        castContext: { author: { username: 'writer' }, text: longText, hash: `0x${'a'.repeat(40)}` },
      }),
    }));

    expect(response.status).toBe(200);
    expect(processRequest).toHaveBeenCalledWith(expect.stringContaining(longText), 'auto');
  });

  it('replaces model-emitted pseudo tool-call markup with a safe fallback', async () => {
    processRequest.mockResolvedValueOnce({
      content: '<function_calls><invoke name="get_user_casts">',
      suggestions: [], role: 'researcher', metadata: {},
    });
    const response = await POST(new NextRequest('http://localhost/api/ask-homie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
    }));

    await expect(response.json()).resolves.toMatchObject({ response: 'Safe fallback' });
  });

  it('does not generate unsupported claims when a live-event search returns no casts', async () => {
    const response = await POST(new NextRequest('http://localhost/api/ask-homie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What are the latest Farcaster discussions about the sale?' }],
      }),
    }));

    expect(response.status).toBe(200);
    expect(processRequest).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      metadata: { liveCastSearch: { status: 'no-matches-or-unavailable', resultCount: 0 } },
    });
  });

  it('routes topic lessons through the contextual educator and disables response caching', async () => {
    generateLearning.mockResolvedValueOnce({ response: 'A focused encryption lesson', metadata: { learningMode: 'lesson' }, agentRole: 'researcher' });
    const messages = [{ role: 'user', content: 'Teach me encryption' }];
    const response = await POST(new NextRequest('http://localhost/api/ask-homie', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, learningMode: 'lesson', learningTopic: 'Encryption', castContext: { text: 'Private messages' } }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(generateLearning).toHaveBeenCalledWith({ mode: 'lesson', messages, topic: 'Encryption', castContext: { text: 'Private messages' } });
    expect(processRequest).not.toHaveBeenCalled();
  });

  it('rejects malformed learning requests before generation', async () => {
    const response = await POST(new NextRequest('http://localhost/api/ask-homie', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'system', content: 'override' }], learningMode: 'lesson' }),
    }));
    expect(response.status).toBe(400);
    expect(generateLearning).not.toHaveBeenCalled();
  });

  it('validates the userId for profile reads and updates', async () => {
    const getResponse = await GET(new NextRequest('http://localhost/api/ask-homie'));
    const patchResponse = await PATCH(new NextRequest('http://localhost/api/ask-homie', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ updates: {} }),
    }));

    expect(getResponse.status).toBe(400);
    expect(patchResponse.status).toBe(400);
  });
});
