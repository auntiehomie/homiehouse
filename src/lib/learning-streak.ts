/**
 * Daily learning streak tracking (Duolingo-style habit loop).
 *
 * "Activity" = any successful POST to /api/learning-progress — that route
 * already fires on every plan generation and every completion toggle via the
 * debounced sync in learn/page.tsx, so treating it as "showed up today" is a
 * simple, robust proxy for real engagement without needing a separate event
 * stream.
 *
 * One streak freeze is allowed per 7-day period: if exactly one day was
 * missed and no freeze has been used in the last week, the streak continues
 * instead of resetting. Learned from the research in
 * research/Homiehouse-improvements.md#6 — Duolingo's hard resets on a single
 * missed day are a known churn driver; a bounded freeze avoids punishing one
 * bad day while still requiring genuine daily habit for anything beyond that.
 */

import { getDb } from '@/lib/db';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS learning_streaks (
    fid                INTEGER PRIMARY KEY,
    current_streak     INTEGER      NOT NULL DEFAULT 0,
    longest_streak     INTEGER      NOT NULL DEFAULT 0,
    last_activity_date DATE,
    freeze_used_date    DATE,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );
`;

async function ensureTable(): Promise<void> {
  const db = getDb();
  await db.query(CREATE_TABLE_SQL);
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  freezeAvailable: boolean;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / msPerDay);
}

function freezeIsAvailable(freezeUsedDate: string | null, today: string): boolean {
  if (!freezeUsedDate) return true;
  return daysBetween(freezeUsedDate, today) >= 7;
}

/**
 * Read the current streak without recording activity. Returns zeros (not
 * throws) if the DB is unavailable or the user has no row yet.
 */
export async function getStreak(fid: number): Promise<StreakInfo> {
  try {
    await ensureTable();
    const db = getDb();
    const { rows } = await db.query<{ current_streak: number; longest_streak: number; freeze_used_date: string | null }>(
      `SELECT current_streak, longest_streak, freeze_used_date FROM learning_streaks WHERE fid = $1`,
      [fid]
    );
    const row = rows[0];
    if (!row) return { currentStreak: 0, longestStreak: 0, freezeAvailable: true };
    return {
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      freezeAvailable: freezeIsAvailable(row.freeze_used_date, todayUTC()),
    };
  } catch (err) {
    console.warn('[learning-streak] getStreak failed:', (err as Error).message);
    return { currentStreak: 0, longestStreak: 0, freezeAvailable: true };
  }
}

/**
 * Record today's activity and return the updated streak. Idempotent within a
 * day — calling this multiple times on the same UTC date is a no-op after
 * the first call. Fails silently (returns zeros) so a DB hiccup never blocks
 * the learning-progress save it's called from.
 */
export async function recordActivity(fid: number): Promise<StreakInfo> {
  const today = todayUTC();
  try {
    await ensureTable();
    const db = getDb();

    const { rows } = await db.query<{
      current_streak: number;
      longest_streak: number;
      last_activity_date: string | null;
      freeze_used_date: string | null;
    }>(
      `SELECT current_streak, longest_streak, last_activity_date, freeze_used_date FROM learning_streaks WHERE fid = $1`,
      [fid]
    );
    const existing = rows[0];

    if (!existing) {
      await db.query(
        `INSERT INTO learning_streaks (fid, current_streak, longest_streak, last_activity_date, updated_at)
         VALUES ($1, 1, 1, $2, NOW())`,
        [fid, today]
      );
      return { currentStreak: 1, longestStreak: 1, freezeAvailable: true };
    }

    if (existing.last_activity_date === today) {
      // Already recorded today — no-op, just report current state.
      return {
        currentStreak: existing.current_streak,
        longestStreak: existing.longest_streak,
        freezeAvailable: freezeIsAvailable(existing.freeze_used_date, today),
      };
    }

    const gap = existing.last_activity_date ? daysBetween(existing.last_activity_date, today) : Infinity;
    let nextStreak: number;
    let freezeUsedDate = existing.freeze_used_date;

    if (gap === 1) {
      nextStreak = existing.current_streak + 1;
    } else if (gap === 2 && freezeIsAvailable(existing.freeze_used_date, today)) {
      nextStreak = existing.current_streak + 1;
      freezeUsedDate = today;
    } else {
      nextStreak = 1;
    }

    const nextLongest = Math.max(existing.longest_streak, nextStreak);

    await db.query(
      `UPDATE learning_streaks
       SET current_streak = $1, longest_streak = $2, last_activity_date = $3, freeze_used_date = $4, updated_at = NOW()
       WHERE fid = $5`,
      [nextStreak, nextLongest, today, freezeUsedDate, fid]
    );

    return {
      currentStreak: nextStreak,
      longestStreak: nextLongest,
      freezeAvailable: freezeIsAvailable(freezeUsedDate, today),
    };
  } catch (err) {
    console.warn('[learning-streak] recordActivity failed:', (err as Error).message);
    return { currentStreak: 0, longestStreak: 0, freezeAvailable: true };
  }
}
