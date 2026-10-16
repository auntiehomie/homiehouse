import { isSaveCastCommand, resolveParentCastHash } from '@/lib/agent-cast-save';

describe('@thehomie cast save command', () => {
  it.each(['save', 'save this', 'save that cast', 'bookmark this post', 'please save this cast!'])(
    'recognizes explicit command: %s',
    (text) => {
      expect(isSaveCastCommand(text)).toBe(true);
    },
  );

  it.each(['save my notes', 'I want to save this', 'please save this idea for later'])(
    'does not treat a sentence as a command: %s',
    (text) => {
      expect(isSaveCastCommand(text)).toBe(false);
    },
  );
});

describe('Hypersnap reply target normalization', () => {
  const hash = `0x${'a'.repeat(40)}`;

  it('accepts a raw cast hash', () => {
    expect(resolveParentCastHash(hash)).toBe(hash);
  });

  it('extracts a cast hash from a conversation URL', () => {
    expect(resolveParentCastHash(`https://warpcast.com/~/conversations/${hash}`)).toBe(hash);
  });

  it('rejects references that cannot identify a cast', () => {
    expect(resolveParentCastHash('https://warpcast.com/~/home')).toBeNull();
    expect(resolveParentCastHash(undefined)).toBeNull();
  });
});
