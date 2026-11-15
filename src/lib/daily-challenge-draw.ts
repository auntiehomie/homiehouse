import { randomInt } from 'node:crypto';
import type { Pool } from 'pg';

type Question = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export async function getDailyDraw(db: Pool, date: string, questions: Question[]) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(760042002)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hh2_daily_challenge_draws (
        challenge_date DATE PRIMARY KEY,
        question_index INTEGER NOT NULL,
        question JSONB NOT NULL
      )
    `);
    const existing = await client.query<{ question_index: number; question: Question }>(
      'SELECT question_index, question FROM hh2_daily_challenge_draws WHERE challenge_date = $1', [date]
    );
    let draw = existing.rows[0];
    if (!draw) {
      const history = await client.query<{ question_index: number; uses: number }>(`
        SELECT question_index, COUNT(*)::integer AS uses
        FROM hh2_daily_challenge_draws GROUP BY question_index
      `);
      const counts = new Map(history.rows.map(row => [row.question_index, row.uses]));
      const usage = questions.map((_, index) => counts.get(index) ?? 0);
      const minimum = Math.min(...usage);
      const eligible = usage.flatMap((count, index) => count === minimum ? [index] : []);
      const latest = await client.query<{ question_index: number }>(
        'SELECT question_index FROM hh2_daily_challenge_draws ORDER BY challenge_date DESC LIMIT 1'
      );
      const lastIndex = latest.rows[0]?.question_index;
      const candidates = eligible.length > 1 ? eligible.filter(index => index !== lastIndex) : eligible;
      const questionIndex = candidates[randomInt(candidates.length)];
      const source = questions[questionIndex];
      const order = source.options.map((_, index) => index);
      for (let index = order.length - 1; index > 0; index--) {
        const swap = randomInt(index + 1);
        [order[index], order[swap]] = [order[swap], order[index]];
      }
      draw = {
        question_index: questionIndex,
        question: {
          ...source,
          options: order.map(index => source.options[index]),
          correctIndex: order.indexOf(source.correctIndex),
        },
      };
      await client.query(
        'INSERT INTO hh2_daily_challenge_draws VALUES ($1, $2, $3)',
        [date, draw.question_index, JSON.stringify(draw.question)]
      );
    }
    await client.query('COMMIT');
    return draw;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
