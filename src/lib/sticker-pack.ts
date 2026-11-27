export const NETWORK_CODE_MANIFESTS = [
  'https://vibeshift.onchain.cooking/api/vibeshift/sticker-packs/network-code?revision=3',
  'https://vibeshift.onchain.cooking/miniapps/vibeshift/stickers/network-code/v3/pack.json',
] as const;
export const MAX_MANIFEST_BYTES = 128 * 1024;
export type Sticker = { id: string; name: string; alt: string; url: string; tags: string[] };
export type StickerPack = { name: string; stickers: Sticker[] };
export function validateStickerPack(input: unknown): StickerPack {
  if (!input || typeof input !== 'object') throw new Error('Invalid sticker pack');
  const pack = input as Record<string, unknown>;
  if (pack.format !== 'farcaster-sticker-pack' || pack.version !== 1 || typeof pack.name !== 'string' || !Array.isArray(pack.stickers) || pack.stickers.length > 100 || !pack.stickers.length) throw new Error('Unsupported sticker pack');
  const ids = new Set<string>();
  const stickers = pack.stickers.map((value: unknown): Sticker => {
    if (!value || typeof value !== 'object') throw new Error('Invalid sticker');
    const s = value as Record<string, unknown>;
    if (typeof s.id !== 'string' || !s.id || ids.has(s.id) || typeof s.name !== 'string' || typeof s.alt !== 'string' || typeof s.url !== 'string' || !['image/webp','image/png','image/gif'].includes(String(s.mimeType)) || typeof s.width !== 'number' || !Number.isInteger(s.width) || s.width < 1 || s.width > 2048 || typeof s.height !== 'number' || !Number.isInteger(s.height) || s.height < 1 || s.height > 2048 || typeof s.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(s.sha256)) throw new Error('Invalid sticker');
    let url: URL; try { url = new URL(s.url); } catch { throw new Error('Invalid sticker URL'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hostname === 'localhost' || url.hostname.endsWith('.local') || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname.startsWith('[')) throw new Error('Invalid sticker URL');
    ids.add(s.id);
    return { id:s.id, name:s.name.slice(0,200), alt:s.alt.slice(0,200) || 'Sticker', url:s.url, tags:Array.isArray(s.tags) ? s.tags.filter((x):x is string => typeof x === 'string').slice(0,30) : [] };
  });
  return { name: pack.name.slice(0,200), stickers };
}
