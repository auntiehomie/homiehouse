export const FARCASTER_INBOX_URL = 'https://farcaster.xyz/~/inbox';

/** Official client intent: opens a composer; never sends a message itself. */
export function directMessageUrl(fid: unknown): string | null {
  if (typeof fid !== 'string' && typeof fid !== 'number') return null;
  if (!/^\d+$/.test(String(fid))) return null;
  const recipient = Number(fid);
  return Number.isSafeInteger(recipient) && recipient > 0
    ? `${FARCASTER_INBOX_URL}/create/${recipient}` : null;
}
