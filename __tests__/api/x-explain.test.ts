import { NextRequest } from 'next/server';
import { POST } from '@/app/api/agent/x-explain/route';
import { explainXPost } from '@/lib/ai/x-explain';
import { checkRateLimit } from '@/lib/ratelimit';

jest.mock('@/lib/ai/x-explain', () => ({ explainXPost: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: jest.fn(),
  rateLimitKeyFromRequest: () => 'ip:127.0.0.1',
}));

const mockExplain = explainXPost as jest.Mock;
const mockRateLimit = checkRateLimit as jest.Mock;

describe('POST /api/agent/x-explain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.mockResolvedValue({ success: true, remaining: 29 });
    mockExplain.mockResolvedValue('A plain-language explanation.');
  });

  it('uses the shared distributed rate-limit interface', async () => {
    const request = new NextRequest('http://localhost/api/agent/x-explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'What does this post mean?' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockRateLimit).toHaveBeenCalledWith('agent-x-explain:ip:127.0.0.1', 30, 60);
    expect(mockExplain).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized posts before calling the model', async () => {
    const request = new NextRequest('http://localhost/api/agent/x-explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'x'.repeat(5_001) }),
    });

    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(mockExplain).not.toHaveBeenCalled();
  });
});
