import { castTextBytes, castTypeForText, splitCastText, publishCastParts } from '@/lib/cast-text';
import { CastType } from '@/lib/fc-message-builder';

describe('cast byte limits and threads', () => {
  it('chooses type by UTF-8 bytes rather than JavaScript length', () => {
    expect(castTypeForText('a'.repeat(320))).toBe(CastType.CAST);
    expect(castTypeForText('🏠'.repeat(81))).toBe(CastType.LONG_CAST);
    expect(castTypeForText('a'.repeat(1024))).toBe(CastType.LONG_CAST);
    expect(() => castTypeForText('a'.repeat(1025))).toThrow('thread');
  });
  it.each(['a'.repeat(1442), '🏠é’.\n'.repeat(600), 'x'.repeat(10000)])('splits a research answer without losing text', text => {
    const parts = splitCastText(text);
    expect(parts.join('')).toBe(text);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every(part => castTextBytes(part) <= 1024)).toBe(true);
    expect(parts.every(part => !part.includes('\ufffd'))).toBe(true);
  });
  it('links each reply and retries only unacknowledged parts', async () => {
    const hashes = ['0x' + 'a'.repeat(40), '0x' + 'b'.repeat(40), '0x' + 'c'.repeat(40)];
    const publish = jest.fn().mockResolvedValueOnce({ castHash: hashes[0] }).mockRejectedValueOnce(new Error('offline'));
    const progress = { hashes: [] as string[] };
    await expect(publishCastParts(['one', 'two', 'three'], progress, publish)).rejects.toThrow('offline');
    expect(progress.hashes).toEqual([hashes[0]]);
    publish.mockResolvedValueOnce({ castHash: hashes[1] }).mockResolvedValueOnce({ castHash: hashes[2] });
    await publishCastParts(['one', 'two', 'three'], progress, publish);
    expect(publish.mock.calls).toEqual([['one', undefined], ['two', hashes[0]], ['two', hashes[0]], ['three', hashes[1]]]);
  });
});
