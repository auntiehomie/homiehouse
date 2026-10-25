import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/learning-plan/route';
import { POST as lessonPOST } from '@/app/api/lesson/route';
import { KNOWLEDGE_LIBRARY_CURRICULUM } from '@/lib/knowledge-library-curriculum';
import { getReadingGrounding } from '@/lib/reading-grounding';
import { llmChat, getLLMProviders } from '@/lib/llm';

jest.mock('@/lib/auth', () => ({ verifyFarcasterSignerAuth: jest.fn(async () => { throw new Error('guest'); }) }));
jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => ({ success: true })) }));
jest.mock('@/lib/llm', () => ({ llmChat: jest.fn(), getLLMProviders: jest.fn(() => []) }));
jest.mock('@/lib/kb-curriculum', () => ({ getKBModulesForTrack: jest.fn(async () => []), deduplicateModules: jest.fn((_existing, candidates) => candidates) }));
jest.mock('@/lib/kb-sync', () => ({ getRelevantKBArticles: jest.fn(async () => []), formatKBContext: jest.fn(() => '') }));
jest.mock('@/lib/logger', () => ({ createApiLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })) }));

beforeEach(() => { jest.clearAllMocks(); jest.mocked(getLLMProviders).mockReturnValue([]); });
const request = (body: unknown) => new NextRequest('http://localhost/api/lesson', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('the public plan exposes all nine authored courses through GET and POST', async () => {
  const get = await GET(new NextRequest('http://localhost/api/learning-plan?track=knowledge-library'));
  const post = await POST(request({ track: 'knowledge-library', level: 'beginner' }));
  expect(get.status).toBe(200);
  expect(await get.json()).toEqual(await post.json());
  expect(KNOWLEDGE_LIBRARY_CURRICULUM).toHaveLength(9);
  expect(llmChat).not.toHaveBeenCalled();
});

test('every authored course is served without AI and has unambiguous quiz choices', async () => {
  for (const lesson of KNOWLEDGE_LIBRARY_CURRICULUM) {
    const result = await lessonPOST(request({ ...lesson.module, moduleId: lesson.module.id }));
    expect(result.headers.get('X-HomieHouse-Lesson-Source')).toBe('curated');
    expect((await result.json()).concepts).toEqual(lesson.concepts);
    for (const question of lesson.quiz) {
      expect(new Set(question.options).size).toBe(4);
      expect(question.options[question.correctIndex]).toBeTruthy();
    }
  }
});

test('cast-specific requests still call AI with reviewed sources even when the KB is empty', async () => {
  const lesson = KNOWLEDGE_LIBRARY_CURRICULUM.find(item => item.module.id === 'dao-voting-and-accountability')!;
  jest.mocked(getLLMProviders).mockReturnValue(['fixture'] as any);
  jest.mocked(llmChat).mockResolvedValue({ message: { content: JSON.stringify(lesson) }, provider: 'fixture' } as any);
  const result = await lessonPOST(request({ ...lesson.module, moduleId: lesson.module.id, sourceCast: { text: 'A DAO vote can be bought. Does governance help?' } }));
  expect(result.status).toBe(200);
  expect(result.headers.get('X-HomieHouse-Lesson-Source')).not.toBe('curated');
  expect(llmChat).toHaveBeenCalled();
  const prompt = JSON.stringify(jest.mocked(llmChat).mock.calls[0][0].messages);
  expect(prompt).toContain('A DAO vote can be bought');
  expect(prompt).toContain('Reviewed Reading Context');
  expect(prompt).toContain('voting3.html');
  expect(prompt).toContain('do not substitute a generic course');
});

test('matching uses whole terms and preserves research limits and sources', () => {
  expect(getReadingGrounding('chair repair daily mail')).toMatchObject({ sources: [], content: '' });
  expect(getReadingGrounding('DAOs and governance')).toMatchObject({ lessonIds: ['dao-voting-and-accountability'] });
  const privacy = getReadingGrounding('Zcash privacy');
  expect(privacy.content).toContain('2018');
  expect(privacy.content).toContain('abstract');
  expect(privacy.sources.some(source => source.url.includes('1805.03180'))).toBe(true);
});
