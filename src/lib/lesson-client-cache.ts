import { getAuthHeaders } from '@/lib/client-auth';
import { correctLessonRepositoryReferences } from '@/lib/lesson-source-corrections';

export interface LessonModuleRequest {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  objectives: string[];
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  sourceCast?: { author?: string; text: string };
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

function normalizeLessonContent(value: unknown): LessonContent | null {
  if (!value || typeof value !== 'object') return null;
  const lesson = value as Partial<LessonContent>;
  const concepts = Array.isArray(lesson.concepts)
    ? lesson.concepts.flatMap((concept) => {
        if (!concept || typeof concept !== 'object') return [];
        const title = typeof concept.title === 'string' ? concept.title.trim() : '';
        const explanation = typeof concept.explanation === 'string' ? concept.explanation.trim() : '';
        if (!explanation) return [];
        return [{
          title: title || 'Key concept',
          explanation,
          ...(typeof concept.analogy === 'string' && concept.analogy.trim() ? { analogy: concept.analogy.trim() } : {}),
        }];
      })
    : [];
  const quiz = Array.isArray(lesson.quiz)
    ? lesson.quiz.flatMap((question) => {
        if (!question || typeof question !== 'object') return [];
        const options = Array.isArray(question.options)
          ? question.options.filter((option): option is string => typeof option === 'string').map(option => option.trim()).filter(Boolean)
          : [];
        const correctIndex = Number.isInteger(question.correctIndex) ? question.correctIndex : 0;
        if (typeof question.question !== 'string' || !question.question.trim() || options.length < 2 || correctIndex < 0 || correctIndex >= options.length) return [];
        return [{
          question: question.question.trim(),
          options,
          correctIndex,
          explanation: typeof question.explanation === 'string' ? question.explanation : '',
        }];
      })
    : [];
  if (typeof lesson.intro !== 'string' || concepts.length === 0 || quiz.length === 0) return null;
  return {
    intro: lesson.intro,
    concepts,
    practicalExample: typeof lesson.practicalExample === 'string' ? lesson.practicalExample : '',
    quickActions: Array.isArray(lesson.quickActions) ? lesson.quickActions.filter((action): action is string => typeof action === 'string') : [],
    summary: typeof lesson.summary === 'string' ? lesson.summary : '',
    quiz,
  };
}

const CACHE_PREFIX = 'hh_lesson_v2:';
const CACHE_INDEX_KEY = 'hh_lesson_cache_index_v2';
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
    sourceCast: module.sourceCast,
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
    const lesson = normalizeLessonContent(cached?.lesson);
    if (!cached || !lesson || Date.now() - cached.cachedAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    touchIndex(key);
    const correctedLesson = correctLessonRepositoryReferences(lesson);
    if (JSON.stringify(correctedLesson) !== JSON.stringify(cached.lesson)) {
      window.localStorage.setItem(key, JSON.stringify({ ...cached, lesson: correctedLesson }));
    }
    return correctedLesson;
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
  const authenticated = Boolean(getAuthHeaders());
  const cached = authenticated ? null : getCachedLesson(module, eli5);
  if (cached) return Promise.resolve(cached);

  const key = lessonKey(module, eli5);
  // Authenticated requests register a user-specific server-side reward attempt.
  // Never coalesce them with a guest or different-account request.
  const existing = authenticated ? undefined : inflight.get(key);
  if (existing) return existing;

  const request = fetch('/api/lesson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(getAuthHeaders() ?? {}) },
    body: JSON.stringify({ ...module, moduleId: module.id, eli5 }),
  })
    .then(async response => {
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to load lesson');
      const normalized = normalizeLessonContent(data);
      if (!normalized) throw new Error('The generated lesson was incomplete. Please try again.');
      const lesson = correctLessonRepositoryReferences(normalized);
      // Don't cache fallback lessons — they're temporary content from AI provider failures.
      if (response.headers.get('X-HomieHouse-Lesson-Source') !== 'fallback') {
        cacheLesson(module, eli5, lesson);
      }
      return lesson;
    })
    .finally(() => { if (!authenticated) inflight.delete(key); });

  if (!authenticated) inflight.set(key, request);
  return request;
}

export function prefetchLesson(module: LessonModuleRequest, eli5: boolean): void {
  // Authenticated lesson requests start the server-side reward timer. Fetch them
  // only after the learner opens the lesson, never while the plan is prefetching.
  if (getAuthHeaders()) return;
  void loadLesson(module, eli5).catch(() => {
    // Prefetching is best-effort; the lesson screen owns user-facing errors.
  });
}
