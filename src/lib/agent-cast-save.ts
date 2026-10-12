import { sql } from '@/lib/db';
import { extractCastText } from '@/lib/agent-context';
import { fetchCast } from '@/lib/hypersnap';

const FARCASTER_EPOCH_MS = 1609459200000;

/** Recognize a clear save command without treating ordinary discussion as an action. */
export function isSaveCastCommand(text: string): boolean {
  return /^(?:please\s+)?(?:save|bookmark)(?:\s+(?:this|that))?(?:\s+(?:cast|post))?[.!?]*$/i.test(
    text.trim().replace(/\s+/g, ' '),
  );
}

function parseCastTimestamp(value: unknown): Date | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric > 1_000_000_000_000 ? numeric : numeric > 1_000_000_000 ? numeric * 1000 : FARCASTER_EPOCH_MS + numeric * 1000)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Save a public parent cast into the notes collection for the Farcaster user
 * who issued the command. The user's FID comes from the verified cast author
 * returned by Hypersnap, never from user-controlled command text.
 */
export async function saveReplyTargetCast(params: {
  userFid: number;
  username: string;
  parentHash: string;
}): Promise<void> {
  if (!Number.isSafeInteger(params.userFid) || params.userFid <= 0) {
    throw new Error('A valid Farcaster user ID is required');
  }
  if (!params.parentHash?.trim()) throw new Error('Reply directly to a cast to save it');

  const response = await fetchCast(params.parentHash);
  const cast = response?.data?.cast ?? response?.cast;
  const castText = extractCastText(cast);
  const castHash = typeof cast?.hash === 'string' ? cast.hash : params.parentHash;
  if (!castText) throw new Error('The parent cast could not be loaded');

  await sql`
    INSERT INTO users (fid, username)
    VALUES (${params.userFid}, ${params.username || null})
    ON CONFLICT (fid) DO UPDATE SET
      username = COALESCE(EXCLUDED.username, users.username),
      updated_at = NOW()
  `;
  const [user] = await sql`SELECT id FROM users WHERE fid = ${params.userFid} LIMIT 1`;
  if (!user?.id) throw new Error('Could not find the HomieHouse user record');

  const timestamp = parseCastTimestamp(cast.timestamp);
  const embeds = Array.isArray(cast.embeds) ? cast.embeds : [];
  const [saved] = await sql`
    INSERT INTO saved_casts (
      user_id, cast_hash, cast_author_fid, cast_author_username,
      cast_text, cast_timestamp, embeds, raw_cast
    )
    VALUES (
      ${user.id}, ${castHash}, ${cast.author?.fid ?? null},
      ${cast.author?.username ?? null}, ${castText}, ${timestamp},
      ${JSON.stringify(embeds)}::jsonb, ${JSON.stringify(cast)}::jsonb
    )
    ON CONFLICT (user_id, cast_hash) DO UPDATE SET
      cast_text = COALESCE(saved_casts.cast_text, EXCLUDED.cast_text),
      raw_cast = COALESCE(saved_casts.raw_cast, EXCLUDED.raw_cast)
    RETURNING id
  `;
  if (!saved?.id) throw new Error('The cast was not saved');
}
