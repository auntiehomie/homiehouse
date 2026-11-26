export const CASTBOARDS = [
  { slug: 'builders', title: 'Builders', description: 'Shipping on Farcaster and the open web.', channels: ['farcaster', 'dev'] },
  { slug: 'ai', title: 'AI & agents', description: 'Models, experiments, and useful agents.', channels: ['ai', 'machine-learning'] },
  { slug: 'onchain', title: 'Onchain', description: 'Ethereum, Base, and onchain communities.', channels: ['ethereum', 'base'] },
  { slug: 'creative', title: 'Art & design', description: 'Creative work and the people making it.', channels: ['art', 'design'] },
] as const;
export type Castboard = typeof CASTBOARDS[number];
export function getCastboard(slug: string): Castboard | undefined {
  return CASTBOARDS.find(board => board.slug === slug);
}
export interface BoardCast {
  hash: string;
  text?: string;
  timestamp?: string;
  author?: { username?: string; display_name?: string; fid?: number };
  castboardChannel: string;
}

/** A bounded recent sample, not a full-history search or a relevance classifier. */
export async function loadCastboard(
  board: Castboard,
  fetchChannel: (id: string, options: { limit: number }) => Promise<{ casts?: Omit<BoardCast, 'castboardChannel'>[] }>,
) {
  const results = await Promise.allSettled(board.channels.map(id => fetchChannel(id, { limit: 25 })));
  const failedChannels: string[] = [];
  const byHash = new Map<string, BoardCast>();
  results.forEach((result, index) => {
    const channel = board.channels[index];
    if (result.status === 'rejected' || !Array.isArray(result.value.casts)) {
      failedChannels.push(channel);
      return;
    }
    for (const cast of result.value.casts.slice(0, 25)) {
      if (typeof cast?.hash !== 'string' || !cast.hash) continue;
      const key = cast.hash.toLowerCase();
      if (!byHash.has(key)) byHash.set(key, { ...cast, castboardChannel: channel });
    }
  });
  const time = (cast: BoardCast) => Date.parse(cast.timestamp || '') || 0;
  const casts = [...byHash.values()].sort((a, b) => time(b) - time(a));
  return { casts, failedChannels };
}
