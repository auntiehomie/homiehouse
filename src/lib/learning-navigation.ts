export function buildLearningModuleReturnTo(moduleId: string): string {
  return `/learn/module?id=${encodeURIComponent(moduleId)}`;
}

/** Restrict composer return navigation to known same-app routes. */
export function resolveComposeReturnDestination(returnTo: string | null): string | null {
  if (returnTo === '/learn') return '/learn';
  if (returnTo?.startsWith('/learn/module?')) return returnTo;
  if (returnTo === '/ask-homie' || returnTo?.startsWith('/ask-homie?')) return returnTo;
  return null;
}
