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
  it('coalesces an active prefetch and card request for the same sentence', async () => {
    const text = 'Different nodes collaborate on a shared network.';
    const scene = { source: text, layout: 'network', labels: ['nodes', 'network'] };
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
    let finish!: (value: unknown) => void;
    global.fetch = jest.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const first = loadExistingLessonScene(text);
    const second = loadExistingLessonScene(text);
    finish({ ok: true, json: async () => ({ plan: scene }) });
    expect(await Promise.all([first, second])).toEqual([scene, scene]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

});
