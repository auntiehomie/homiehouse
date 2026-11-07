import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/learning-plan/route';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { llmChat } from '@/lib/llm';
import { getKBModulesForTrack } from '@/lib/kb-curriculum';

jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerAuth: jest.fn(async () => 123) }));
jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => ({ success: true })) }));
jest.mock('@/lib/llm', () => ({ llmChat: jest.fn() }));
jest.mock('@/lib/kb-curriculum', () => ({ getKBModulesForTrack: jest.fn(async () => []), deduplicateModules: jest.fn((_existing, candidates) => candidates) }));

describe('selecting an AI path with existing reward progress', () => {
  const query = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyFarcasterSignerAuth as jest.Mock).mockResolvedValue(123);
    query.mockResolvedValue({ rows: [{ plan: { track: 'decentralization', modules: [{ id: 'previous-earned' }] } }] });
    (getDb as jest.Mock).mockReturnValue({ query });
  });
  it('returns AI starter content and extends the existing assignment', async () => {
    const response = await GET(new NextRequest('http://localhost/api/learning-plan?track=ai&level=beginner'));
    const body = await response.json();
    expect(body.track).toBe('ai');
    expect(body.modules.length).toBeGreaterThan(0);
    expect(body.modules.some((item: { id: string }) => item.id === 'previous-earned')).toBe(false);
    const update = query.mock.calls.find(([sql]) => sql.includes('UPDATE learning_reward_plans'));
    expect(update[0]).toContain('WHERE NOT EXISTS');
    expect(update[1][0]).toBe(123);
    expect(query.mock.calls.some(([sql]) => /DELETE FROM/.test(sql))).toBe(false);
  });
  it('grounds AI generation in both KB and available web results', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    const oldFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ title: 'Agent guide', url: 'https://example.org/agents', content: 'Agents use tools.' }] }) });
    (getKBModulesForTrack as jest.Mock).mockResolvedValue([{ id: 'kb-ai', title: 'KB AI', description: 'KB grounding', whyItMatters: 'Context', objectives: ['Learn'], estimatedMinutes: 20, difficulty: 'beginner', tags: ['ai'], sourceUrl: 'https://example.org/kb' }]);
    (llmChat as jest.Mock).mockResolvedValue({ message: { content: JSON.stringify({ summary: 'AI path', modules: [{ id: 'ai-agents', title: 'AI agents', description: 'Agents', whyItMatters: 'Context', objectives: ['Learn'], estimatedMinutes: 20, difficulty: 'beginner', tags: ['ai'], sourceUrl: 'https://example.org/agents' }] }) } });
    try {
      const response = await POST(new NextRequest('http://localhost/api/learning-plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ track: 'ai', level: 'beginner', specificGoals: 'AI for creators' }) }));
      const body = await response.json();
      expect(body.track).toBe('ai');
      expect(body.research).toEqual({ web: true, knowledgeBase: true, webProvider: 'tavily', personalized: true });
      expect(body.modules[0].sourceUrl).toBe('https://example.org/agents');
      const prompt = (llmChat as jest.Mock).mock.calls[0][0].messages[1].content;
      expect(prompt).toContain('KB grounding');
      expect(prompt).toContain('Agents use tools.');
    } finally { global.fetch = oldFetch; delete process.env.TAVILY_API_KEY; }
  });
});
