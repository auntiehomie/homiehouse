import { sql } from './db';

export interface SponsoredCast {
  id: number;
  cast_hash: string;
}

/**
 * Fetch a sponsored cast with remaining budget.
 * Atomically increments impression count and decrements budget.
 * Returns null if no sponsored casts are available.
 */
export async function fetchSponsoredCast(excludeHash?: string): Promise<SponsoredCast | null> {
  let rows: any[];

  if (excludeHash) {
    rows = await sql`
      SELECT id, sponsor_fid, cast_hash, impression_count, click_count, budget_remaining, created_at
      FROM sponsored_casts
      WHERE budget_remaining > 0
        AND cast_hash != ${excludeHash}
      ORDER BY budget_remaining DESC, created_at DESC
      LIMIT 1
    `;
  } else {
    rows = await sql`
      SELECT id, sponsor_fid, cast_hash, impression_count, click_count, budget_remaining, created_at
      FROM sponsored_casts
      WHERE budget_remaining > 0
      ORDER BY budget_remaining DESC, created_at DESC
      LIMIT 1
    `;
  }

  if (rows.length === 0) {
    return null;
  }

  const sponsored = rows[0];

  // Increment impression count and decrement budget atomically (prevents over-spend)
  await sql`
    UPDATE sponsored_casts
    SET impression_count = impression_count + 1, budget_remaining = budget_remaining - 1
    WHERE id = ${sponsored.id} AND budget_remaining > 0
  `;

  // Only expose non-sensitive fields
  return {
    id: sponsored.id,
    cast_hash: sponsored.cast_hash,
  };
}

/**
 * Record a click on a sponsored cast.
 */
export async function recordSponsoredCastClick(id: number): Promise<void> {
  await sql`
    UPDATE sponsored_casts
    SET click_count = click_count + 1
    WHERE id = ${id}
  `;
}
