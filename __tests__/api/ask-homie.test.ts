import { NextRequest } from 'next/server';
import { POST, GET, PATCH } from '@/app/api/ask-homie/route';

var processRequest = jest.fn();
var getProfile = jest.fn();
var getStats = jest.fn();
var updateProfile = jest.fn();
var addCast = jest.fn();

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

  it('validates the userId for profile reads and updates', async () => {
    const getResponse = await GET(new NextRequest('http://localhost/api/ask-homie'));
    const patchResponse = await PATCH(new NextRequest('http://localhost/api/ask-homie', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ updates: {} }),
    }));

    expect(getResponse.status).toBe(400);
    expect(patchResponse.status).toBe(400);
  });
});
