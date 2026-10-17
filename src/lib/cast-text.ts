import { CastType } from './fc-message-builder';

export const MAX_CAST_BYTES = 1024;
export const castTextBytes = (text: string): number => new TextEncoder().encode(text).length;

export function castTypeForText(text: string): CastType {
  const bytes = castTextBytes(text);
  if (bytes > MAX_CAST_BYTES) throw new Error('This text needs a thread. Each cast can contain up to 1,024 bytes.');
  return bytes > 320 ? CastType.LONG_CAST : CastType.CAST;
}

/** Preserve all text and Unicode code points while respecting the node's byte limit. */
export function splitCastText(text: string): string[] {
  const parts: string[] = [];
  let part = '';
  let bytes = 0;
  for (const point of text) {
    const size = castTextBytes(point);
    if (bytes + size > MAX_CAST_BYTES) {
      parts.push(part);
      part = '';
      bytes = 0;
    }
    part += point;
    bytes += size;
  }
  if (part || !parts.length) parts.push(part);
  return parts;
}

export interface ThreadProgress { hashes: string[] }

/** Retain acknowledged hashes so retrying a partial thread continues at its next part. */
export async function publishCastParts(
  parts: string[],
  progress: ThreadProgress,
  publish: (text: string, parentHash?: string) => Promise<{ castHash: string }>,
): Promise<void> {
  while (progress.hashes.length < parts.length) {
    const index = progress.hashes.length;
    const result = await publish(parts[index], progress.hashes[index - 1]);
    if (!/^(?:0x)?[0-9a-f]{40}$/i.test(result.castHash)) throw new Error('The node did not confirm a cast hash. Check your profile before retrying.');
    progress.hashes.push(result.castHash);
  }
}
