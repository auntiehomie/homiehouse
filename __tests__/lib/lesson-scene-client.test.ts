import { loadExistingLessonScene } from '@/lib/lesson-scene-client';

describe('existing lesson scene cache', () => {
  const sentence = 'Independent nodes share control.';
  const plan = { source: sentence, layout: 'network', labels: ['Independent nodes', 'control'] };
  it('reuses a generated scene without changing lesson progress', async () => {
    const values = new Map<string, string>([['hh_learning_progress', '["completed"]']]);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ plan }) });
    expect(await loadExistingLessonScene(sentence)).toEqual(plan);
    expect(await loadExistingLessonScene(sentence)).toEqual(plan);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(values.get('hh_learning_progress')).toBe('["completed"]');
  });
});
