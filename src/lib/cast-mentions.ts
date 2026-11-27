/**
 * Farcaster stores mentions outside the cast text: the protocol body carries
 * `mentions` (FIDs) and `mentions_positions` (UTF-8 byte offsets), and the
 * text itself has the `@username` removed. Hypersnap's Neynar-compatible API
 * passes that raw text through, with `mentioned_profiles` and zero-width
 * `mentioned_profiles_ranges` ({ start, end: start }) marking where each
 * mention belongs. Without re-inserting them, "@alice welcome!" renders as
 * ", welcome!".
 *
 * Neynar-style responses whose ranges already span "@username" in the text
 * are returned unchanged.
 */

type MentionProfile =
  | { fid?: number | string; username?: string | null }
  | null
  | undefined;

interface MentionInsert {
  position: number;
  label: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function labelFor(profile: MentionProfile, fallbackFid?: unknown): string {
  const username =
    typeof profile?.username === "string" ? profile.username.trim() : "";
  if (username && !/^!?\d+$/.test(username) && !/^fid:\d+$/i.test(username))
    return `@${username}`;
  const fid = Number(profile?.fid ?? fallbackFid);
  return Number.isSafeInteger(fid) && fid > 0 ? `@fid:${fid}` : "@unknown";
}

function toPosition(value: unknown): number | null {
  const n =
    typeof value === "object" && value !== null
      ? Number((value as any).start)
      : Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function rangeEnd(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const n = Number((value as any).end);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** Returns the cast text with any stripped @mentions inserted back. */
export function castTextWithMentions(cast: any): string {
  const text: string = typeof cast?.text === "string" ? cast.text : "";
  if (!cast || typeof cast !== "object") return text;

  const profiles: MentionProfile[] = Array.isArray(cast.mentioned_profiles)
    ? cast.mentioned_profiles
    : [];
  const fids: unknown[] = Array.isArray(cast.mentions) ? cast.mentions : [];
  const ranges: unknown[] = Array.isArray(cast.mentioned_profiles_ranges)
    ? cast.mentioned_profiles_ranges
    : [];
  const positions: unknown[] = Array.isArray(cast.mentions_positions)
    ? cast.mentions_positions
    : Array.isArray(cast.mentionsPositions)
      ? cast.mentionsPositions
      : [];

  const bytes = encoder.encode(text);
  const inserts: MentionInsert[] = [];
  const count = Math.max(profiles.length, fids.length);

  for (let i = 0; i < count; i++) {
    const range = ranges[i];
    const position = toPosition(positions[i] ?? range);
    if (position === null || position > bytes.length) continue;

    const end = rangeEnd(range);
    // A range with width already covers the mention inside the text (Neynar).
    if (end !== null && end > position) continue;

    const label = labelFor(profiles[i], fids[i]);
    // Guard against double insertion if a source already put it in the text.
    const following = decoder.decode(
      bytes.subarray(position, position + encoder.encode(label).length),
    );
    if (following === label) continue;

    inserts.push({ position, label });
  }

  if (!inserts.length) return text;

  // Build from the front, copying byte slices between insert points so
  // multi-byte characters (emoji, accents) stay intact.
  inserts.sort((a, b) => a.position - b.position);
  let out = "";
  let cursor = 0;
  for (const { position, label } of inserts) {
    out += decoder.decode(bytes.subarray(cursor, position)) + label;
    cursor = position;
  }
  return out + decoder.decode(bytes.subarray(cursor));
}

/** Returns a shallow copy of the cast whose `text` includes its mentions. */
export function withMentionText<T>(cast: T): T {
  if (!cast || typeof cast !== "object") return cast;
  const next = castTextWithMentions(cast);
  return next === (cast as any).text ? cast : { ...(cast as any), text: next };
}
