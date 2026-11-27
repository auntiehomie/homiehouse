export const CLIPS_PARENT = 'https://homiehouse.app/clips';
export const CLIP_LIMIT = 50 * 1024 * 1024;
export const CLIP_FORMATS = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' } as const;
export type Clip = { hash: string; fid: number; caption: string; url: string };

export function clipVideoUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return /\.(mp4|webm|mov)$/i.test(url.pathname) ||
      (/^\/ipfs\/[a-z0-9]+$/i.test(url.pathname) && /^clip\.(mp4|webm|mov)$/.test(url.searchParams.get('filename') || ''));
  } catch { return false; }
}
