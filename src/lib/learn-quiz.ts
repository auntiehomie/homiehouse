export const LEARN_QUIZ_LESSON_ID = 'agent-permissions-and-oversight';
export const LEARN_QUIZ_PATH = '/learn/quiz';
export const LEARN_QUIZ_URL = new URL(
  LEARN_QUIZ_PATH,
  process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.app',
).href;
