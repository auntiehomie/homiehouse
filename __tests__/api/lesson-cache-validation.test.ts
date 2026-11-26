import { NextRequest } from 'next/server';
import { POST } from '@/app/api/lesson/route';
import { llmChat, getLLMProviders } from '@/lib/llm';

const mockRedisGet = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisSet = jest.fn();

jest.mock('next/server', () => ({ ...jest.requireActual('next/server'), after: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerAuth: jest.fn(async () => { throw new Error('no signer'); }) }));
jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@upstash/redis', () => ({ Redis: jest.fn(() => ({ get: mockRedisGet, del: mockRedisDel, set: mockRedisSet })) }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => ({ success: true })) }));
jest.mock('@/lib/llm', () => ({ llmChat: jest.fn(), getLLMProviders: jest.fn(() => ['mock']) }));
jest.mock('@/lib/kb-sync', () => ({ getRelevantKBArticles: jest.fn(async () => []), formatKBContext: jest.fn(() => '') }));
jest.mock('@/lib/curated-curriculum', () => ({ getCuratedLesson: jest.fn(() => undefined) }));
jest.mock('@/lib/logger', () => ({ createApiLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })) }));
jest.mock('@/lib/lesson-source-corrections', () => ({ correctLessonRepositoryReferences: jest.fn(value => value) }));

const mockLlmChat = llmChat as jest.Mock;
const mockGetLLMProviders = getLLMProviders as jest.Mock;
const lesson = {
  intro: 'Start with the core idea.',
  concepts: [{ title: 'A concept', explanation: 'A complete explanation.' }],
  practicalExample: 'Try a practical example.',
  quickActions: ['Explore the idea'],
  summary: 'A short takeaway.',
  quiz: [{ question: 'Which is correct?', options: ['Correct', 'Incorrect'], correctIndex: 0, explanation: 'Because it is.' }],
};

function request(body = { moduleId: 'generated-cache-test', title: 'Generated cache test', description: 'A lesson test', objectives: ['Understand the idea'] }) {
  return new NextRequest('http://localhost/api/lesson', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/lesson cache validation', () => {
  const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    mockGetLLMProviders.mockReturnValue(['mock']);
    mockRedisGet.mockResolvedValue({ intro: 'Incomplete cached result', concepts: [], quiz: [] });
    mockLlmChat.mockResolvedValue({ message: { content: JSON.stringify(lesson) }, provider: 'mock' });
  });

  afterAll(() => {
    if (originalRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
    if (originalRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
  });


  it('keeps a validated animation plan alongside a generated concept', async () => {
    const sentence = 'Independent nodes share control.';
    const visual = { source: sentence, layout: 'network', labels: ['Independent nodes', 'control'] };
    mockLlmChat.mockResolvedValue({ message: { content: JSON.stringify({ ...lesson, concepts: [{ title: 'Decentralization', explanation: sentence, visuals: [visual] }] }) }, provider: 'mock' });
    const response = await POST(request());
    const result = await response.json();
    expect(result.concepts[0].visuals).toEqual([visual]);
    expect(mockRedisSet).toHaveBeenCalledWith(expect.stringMatching(/^lesson:v14:/), expect.objectContaining({ concepts: [expect.objectContaining({ visuals: [visual] })] }), expect.anything());
  });

  it('discards an incomplete cached lesson and regenerates usable content', async () => {
    const response = await POST(request());
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ intro: lesson.intro, concepts: lesson.concepts });
    expect(result.quiz).toHaveLength(1);
    expect(result.quiz[0].options[result.quiz[0].correctIndex]).toBe('Correct');
    expect(mockRedisDel).toHaveBeenCalledWith(expect.stringMatching(/^lesson:v14:/));
    expect(mockLlmChat).toHaveBeenCalled();
  });

  it('uses only repository-owned source content when building an article-backed lesson', async () => {
    const response = await POST(request({
      moduleId: 'kb-ef-protocol-current-emerging-priorities-2026',
      sourceArticleId: 'ef-protocol-current-emerging-priorities-2026',
      title: 'Protocol priorities and roadmap stages',
      description: 'Learn to distinguish research, proposals, devnets and mainnet releases.',
      objectives: ['Distinguish a roadmap from a shipped change'],
    }));

    expect(response.status).toBe(200);
    const prompt = mockLlmChat.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Repository Knowledge Base source (verified by article ID');
    expect(prompt).toContain('Ethereum Foundation Protocol Cluster');
    expect(prompt).toContain('https://blog.ethereum.org/2026/09/07/protocol-priorities');
    expect(prompt).toContain('not an independent assessment or a guarantee of delivery');
    expect(prompt).toContain('distinguish source evidence from inference');
  });
});
