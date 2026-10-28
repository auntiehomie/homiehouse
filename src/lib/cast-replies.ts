import { hypersnapFetch, fallbackFetch } from './hypersnap';

/** Read direct replies without the recursive conversation service's global reply cap.
 * One hub page plus one bulk author lookup, rather than one request per reply.
 */
export async function fetchDirectReplies(fid: number, hash: string, cursor?: string) {
  const qs = new URLSearchParams({ fid: String(fid), hash, pageSize: '25', reverse: 'false' });
  if (cursor) qs.set('pageToken', cursor);
  const endpoint = `/v1/castsByParent?${qs}`;
  let data: any;
  try {
    data = await hypersnapFetch(endpoint, { cache: 'no-store' });
  } catch {}
  if (!Array.isArray(data?.messages)) data = await fallbackFetch(endpoint, { cache: 'no-store' });
  if (!Array.isArray(data?.messages)) throw new Error('Reply page unavailable');

  const messages = data.messages.filter((m: any) => m.data?.castAddBody);
  const fids = [...new Set(messages.map((m: any) => m.data.fid))];
  let users: any[] = [];
  if (fids.length) {
    const endpoint = `/v2/farcaster/user/bulk?fids=${fids.join(',')}`;
    let profiles: any;
    try { profiles = await hypersnapFetch(endpoint); } catch {}
    if (!Array.isArray(profiles?.users)) profiles = await fallbackFetch(endpoint);
    users = profiles?.users ?? [];
  }
  return {
    casts: messages.map((m: any) => {
      const body = m.data.castAddBody;
      return {
        hash: m.hash,
        author: users.find((u: any) => Number(u.fid) === Number(m.data.fid)) ?? { fid: m.data.fid, username: `fid:${m.data.fid}` },
        text: body.text ?? '',
        timestamp: new Date((m.data.timestamp + 1609459200) * 1000).toISOString(),
        parent_hash: hash,
        parent_author: { fid },
        embeds: body.embeds ?? [],
        mentions: body.mentions ?? [],
        mentions_positions: body.mentionsPositions ?? [],
      };
    }),
    next: data.nextPageToken ? { cursor: data.nextPageToken } : null,
  };
}
