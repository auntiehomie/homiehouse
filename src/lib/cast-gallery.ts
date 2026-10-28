import { MAX_CAST_PHOTOS } from './cast-embeds';

/** Build a shareable Homiehouse page URL for a group of uploaded cast photos. */
export function buildCastGalleryUrl(imageUrls: string[], origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://homiehouse.app');
  const url = new URL('/gallery', base);
  url.searchParams.set('photos', JSON.stringify(imageUrls.slice(0, MAX_CAST_PHOTOS)));
  return url.toString();
}

/** Parse and validate the public photo URLs encoded in a gallery link. */
export function parseCastGalleryImages(value: string | string[] | undefined): string[] {
  if (typeof value !== 'string' || value.length > 12_000) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return [...new Set(parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => {
        try {
          const url = new URL(item);
          return url.protocol === 'https:' ? url.toString() : null;
        } catch {
          return null;
        }
      })
      .filter((item): item is string => item !== null))]
      .slice(0, MAX_CAST_PHOTOS);
  } catch {
    return [];
  }
}

/** Whether a cast embed points to a Homiehouse-hosted gallery. */
export function isCastGalleryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.pathname === '/gallery' && [
      'homiehouse.app', 'www.homiehouse.app',
      'homiehouse.lol', 'www.homiehouse.lol',
    ].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
