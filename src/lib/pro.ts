import { sql } from '@/lib/db';

/**
 * Check if a user has an active Pro subscription.
 * Shared by /api/pro-status, /api/ask-homie, and any other route that gates Pro features.
 */
export async function isProUser(userFid: number): Promise<boolean> {
  try {
    const rows = await sql`
      SELECT id FROM pro_subscribers
      WHERE user_fid = ${userFid}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}
