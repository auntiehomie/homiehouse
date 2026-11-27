import { normalizeLessonScenes, type LessonScene } from '@/lib/lesson-scene';

const inflight = new Map<string, Promise<LessonScene | null>>();
const CACHE_PREFIX = 'hh_lesson_scene_v2:';

function keyForText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return CACHE_PREFIX + (hash >>> 0).toString(36);
}

export function loadExistingLessonScene(text: string): Promise<LessonScene | null> {
  const cardText = text.trim();
  if (cardText.length < 10 || cardText.length > 2000) return Promise.resolve(null);
  const key = keyForText(cardText);
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved?.text === cardText) {
      const plan = normalizeLessonScenes([saved.plan], cardText)[0];
      if (plan?.source === cardText && (plan.layout === 'storyboard' || plan.layout === 'tokenization')) return Promise.resolve(plan);
    }
  } catch { /* Continue without a local cache. */ }
  const pending = inflight.get(cardText);
  if (pending) return pending;
  const request = fetch('/api/lesson-scene', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: cardText }) })
    .then(async response => response.ok ? response.json() : null)
    .then(data => {
      const validated = normalizeLessonScenes([data?.plan], cardText)[0];
      const plan = validated?.source === cardText && (validated.layout === 'storyboard' || validated.layout === 'tokenization') ? validated : null;
      if (plan) try { localStorage.setItem(key, JSON.stringify({ text: cardText, plan })); } catch { /* storage is optional */ }
      return plan;
    })
    .catch(() => null)
    .finally(() => inflight.delete(cardText));
  inflight.set(cardText, request);
  return request;
}
