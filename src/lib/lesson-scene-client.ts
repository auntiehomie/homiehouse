import { normalizeLessonScenes, type LessonScene } from '@/lib/lesson-scene';

const inflight = new Map<string, Promise<LessonScene | null>>();
const CACHE_PREFIX = 'hh_lesson_scene_v1:';

function keyForText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return CACHE_PREFIX + (hash >>> 0).toString(36);
}

export function loadExistingLessonScene(text: string): Promise<LessonScene | null> {
  const sentence = text.split(/(?<=[.!?])\s+/).find(part => part.length >= 10 && part.length <= 500);
  if (!sentence) return Promise.resolve(null);
  const key = keyForText(sentence);
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved?.text === sentence) {
      const plan = normalizeLessonScenes([saved.plan], sentence)[0];
      if (plan) return Promise.resolve(plan);
    }
  } catch { /* Continue without a local cache. */ }
  const pending = inflight.get(sentence);
  if (pending) return pending;
  const request = fetch('/api/lesson-scene', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: sentence }) })
    .then(async response => response.ok ? response.json() : null)
    .then(data => {
      const plan = normalizeLessonScenes([data?.plan], sentence)[0] ?? null;
      if (plan) try { localStorage.setItem(key, JSON.stringify({ text: sentence, plan })); } catch { /* storage is optional */ }
      return plan;
    })
    .catch(() => null)
    .finally(() => inflight.delete(sentence));
  inflight.set(sentence, request);
  return request;
}
