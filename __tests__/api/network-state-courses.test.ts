import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/learning-plan/route';
import { POST as lessonPOST } from '@/app/api/lesson/route';
import { NETWORK_STATE_CURRICULUM } from '@/lib/network-state-curriculum';
import { getCuratedLesson } from '@/lib/curated-curriculum';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { llmChat } from '@/lib/llm';

jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerAuth: jest.fn(async () => { throw new Error('guest'); }) }));
jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => ({ success: true })) }));
jest.mock('@/lib/llm', () => ({ llmChat: jest.fn(), getLLMProviders: jest.fn(() => []) }));
jest.mock('@/lib/kb-curriculum', () => ({ getKBModulesForTrack: jest.fn(async () => []), deduplicateModules: jest.fn((_existing, candidates) => candidates) }));
jest.mock('@/lib/kb-sync', () => ({ getRelevantKBArticles: jest.fn(async () => []), formatKBContext: jest.fn(() => '') }));
jest.mock('@/lib/logger', () => ({ createApiLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })) }));

const request = () => new NextRequest('http://localhost/api/learning-plan', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ track: 'network-states', level: 'beginner' }),
});

describe('balanced Network State courses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyFarcasterSignerAuth as jest.Mock).mockRejectedValue(new Error('guest'));
  });

  it('serves the same four ordered courses through GET and POST without an LLM', async () => {
    const get = await GET(new NextRequest('http://localhost/api/learning-plan?track=network-states'));
    const post = await POST(request());
    expect(get.status).toBe(200);
    expect(post.status).toBe(200);
    const plan = await post.json();
    expect(await get.json()).toEqual(plan);
    expect(plan.modules.map((module: { id: string }) => module.id)).toEqual(NETWORK_STATE_CURRICULUM.map(lesson => lesson.module.id));
    expect(plan.modules).toHaveLength(4);
    expect(llmChat).not.toHaveBeenCalled();
  });

  it('opens every course as reviewed content when no AI providers are configured', async () => {
    for (const lesson of NETWORK_STATE_CURRICULUM) {
      expect(getCuratedLesson(lesson.module.id)).toBe(lesson);
      const response = await lessonPOST(new NextRequest('http://localhost/api/lesson', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...lesson.module, moduleId: lesson.module.id }),
      }));
      expect(response.status).toBe(200);
      expect(response.headers.get('X-HomieHouse-Lesson-Source')).toBe('curated');
      const content = await response.json();
      expect(content.concepts).toEqual(lesson.concepts);
      expect(content.quiz).toEqual(lesson.quiz);
      expect(lesson.sources.some(source => source.url.includes('thenetworkstate.com'))).toBe(true);
      expect(lesson.sources.some(source => !source.url.includes('thenetworkstate.com'))).toBe(true);
      for (const question of content.quiz) {
        expect(question.options).toHaveLength(4);
        expect(new Set(question.options).size).toBe(4);
        expect(question.options[question.correctIndex]).toBeTruthy();
      }
    }
    expect(llmChat).not.toHaveBeenCalled();
  });

  it('extends an existing authenticated assignment without substituting its old plan for the courses', async () => {
    (verifyFarcasterSignerAuth as jest.Mock).mockResolvedValue(123);
    const query = jest.fn().mockResolvedValue({ rows: [{ plan: { modules: [{ id: 'existing-earned-module' }] } }] });
    (getDb as jest.Mock).mockReturnValue({ query });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).modules).toHaveLength(4);
    const update = query.mock.calls.find(([sql]) => sql.includes('UPDATE learning_reward_plans'));
    expect(update[0]).toContain('WHERE NOT EXISTS');
    expect(update[1]).toEqual([123, JSON.stringify(NETWORK_STATE_CURRICULUM.map(lesson => lesson.module))]);
    expect(query.mock.calls.some(([sql]) => /DELETE FROM/.test(sql))).toBe(false);
  });

  it('reports a retryable failure when authenticated progress cannot be prepared', async () => {
    (verifyFarcasterSignerAuth as jest.Mock).mockResolvedValue(123);
    (getDb as jest.Mock).mockReturnValue({ query: jest.fn().mockRejectedValue(new Error('offline')) });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain('try again');
  });
});
