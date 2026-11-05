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

function request() {
  return new NextRequest('http://localhost/api/lesson', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ moduleId: 'generated-cache-test', title: 'Generated cache test', description: 'A lesson test', objectives: ['Understand the idea'] }),
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

  it('discards an incomplete cached lesson and regenerates usable content', async () => {
    const response = await POST(request());
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ intro: lesson.intro, concepts: lesson.concepts });
    expect(result.quiz).toHaveLength(1);
    expect(result.quiz[0].options[result.quiz[0].correctIndex]).toBe('Correct');
    expect(mockRedisDel).toHaveBeenCalledWith(expect.stringMatching(/^lesson:v13:/));
    expect(mockLlmChat).toHaveBeenCalled();
  });
});
