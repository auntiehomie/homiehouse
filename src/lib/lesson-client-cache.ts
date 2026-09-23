export interface LessonModuleRequest {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  objectives: string[];
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

export interface LessonQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonContent {
  intro: string;
  concepts: Array<{ title: string; explanation: string; analogy?: string }>;
  practicalExample: string;
  quickActions: string[];
  summary: string;
  quiz: LessonQuizQuestion[];
}

interface CachedLesson {
  cachedAt: number;
  lesson: LessonContent;
}

const CACHE_PREFIX = 'hh_lesson_v1:';
const CACHE_INDEX_KEY = 'hh_lesson_cache_index_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHED_LESSONS = 6;
const inflight = new Map<string, Promise<LessonContent>>();

function fingerprint(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function lessonKey(module: LessonModuleRequest, eli5: boolean): string {
  const revision = fingerprint(JSON.stringify({
    title: module.title,
    description: module.description,
    whyItMatters: module.whyItMatters,
    objectives: module.objectives,
  }));
  return `${CACHE_PREFIX}${module.id}:${eli5 ? 'eli5' : 'standard'}:${revision}`;
}

function readIndex(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(CACHE_INDEX_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

function touchIndex(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = [key, ...readIndex().filter(item => item !== key)];
    const staleKeys = keys.slice(MAX_CACHED_LESSONS);
    staleKeys.forEach(item => window.localStorage.removeItem(item));
    window.localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(keys.slice(0, MAX_CACHED_LESSONS)));
  } catch {
    // Storage can be unavailable in private browsing. The network path still works.
  }
}

export function getCachedLesson(module: LessonModuleRequest, eli5: boolean): LessonContent | null {
  if (typeof window === 'undefined') return null;
  const key = lessonKey(module, eli5);
  try {
    const cached = JSON.parse(window.localStorage.getItem(key) ?? 'null') as CachedLesson | null;
    if (!cached?.lesson || Date.now() - cached.cachedAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    touchIndex(key);
    return cached.lesson;
  } catch {
    return null;
  }
}

function cacheLesson(module: LessonModuleRequest, eli5: boolean, lesson: LessonContent): void {
  if (typeof window === 'undefined') return;
  const key = lessonKey(module, eli5);
  try {
    window.localStorage.setItem(key, JSON.stringify({ cachedAt: Date.now(), lesson } satisfies CachedLesson));
    touchIndex(key);
  } catch {
    // A full or unavailable localStorage should never prevent a lesson from opening.
  }
}

export function loadLesson(module: LessonModuleRequest, eli5: boolean): Promise<LessonContent> {
  const cached = getCachedLesson(module, eli5);
  if (cached) return Promise.resolve(cached);

  const key = lessonKey(module, eli5);
  const existing = inflight.get(key);
  if (existing) return existing;

  const request = fetch('/api/lesson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...module, eli5 }),
  })
    .then(async response => {
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to load lesson');
      const lesson = data as LessonContent;
      cacheLesson(module, eli5, lesson);
      return lesson;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

export function prefetchLesson(module: LessonModuleRequest, eli5: boolean): void {
  void loadLesson(module, eli5).catch(() => {
    // Prefetching is best-effort; the lesson screen owns user-facing errors.
  });
}
