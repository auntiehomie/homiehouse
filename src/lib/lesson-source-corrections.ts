/** Normalize known stale source references in generated and cached lesson content. */
export function correctLessonRepositoryReferences<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/github\.com\/farcasterxyz\/hypersnap/gi, 'github.com/farcasterorg/hypersnap') as T;
  }
  if (Array.isArray(value)) return value.map(item => correctLessonRepositoryReferences(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(
      ([key, item]) => [key, correctLessonRepositoryReferences(item)],
    )) as T;
  }
  return value;
}
