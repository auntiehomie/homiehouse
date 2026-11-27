import type { Pool } from 'pg';
import { getDailyDraw } from '@/lib/daily-challenge-draw';

const questions = ['First', 'Second', 'Third'].map(question => ({
  question,
  options: ['A', 'B', 'C', 'D'],
  correctIndex: 1,
  explanation: 'B is correct.',
}));

test('persists the shuffled question and uses the full pool before repeating', async () => {
  const draws = new Map<string, { question_index: number; question: typeof questions[number] }>();
  const query = jest.fn(async (sql: string, params: [string, number, string]) => {
    if (sql.startsWith('SELECT question_index, question')) {
      const draw = draws.get(params[0]);
      return { rows: draw ? [draw] : [] };
    }
    if (sql.includes('COUNT(*)')) {
      const usage = new Map<number, number>();
      for (const { question_index } of draws.values()) {
        usage.set(question_index, (usage.get(question_index) ?? 0) + 1);
      }
      return { rows: [...usage].map(([question_index, uses]) => ({ question_index, uses })) };
    }
    if (sql.includes('ORDER BY challenge_date')) {
      return { rows: [...draws.values()].slice(-1) };
    }
    if (sql.startsWith('INSERT')) {
      draws.set(params[0], { question_index: params[1], question: JSON.parse(params[2]) });
    }
    return { rows: [] };
  });
  const db = { connect: async () => ({ query, release: jest.fn() }) } as unknown as Pool;

  const first = await getDailyDraw(db, '2026-11-15', questions);
  expect(await getDailyDraw(db, '2026-11-15', questions)).toEqual(first);
  const second = await getDailyDraw(db, '2026-11-16', questions);
  const third = await getDailyDraw(db, '2026-11-17', questions);

  expect(new Set([first.question_index, second.question_index, third.question_index]).size).toBe(3);
  for (const { question } of [first, second, third]) {
    expect([...question.options].sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(question.options[question.correctIndex]).toBe('B');
  }
  const nextCycle = await getDailyDraw(db, '2026-11-18', questions);
  expect(nextCycle.question_index).not.toBe(third.question_index);
});
