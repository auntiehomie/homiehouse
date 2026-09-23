import {
  fallbackComposeDrafts,
  noteSources,
  parseComposeDrafts,
  reactionSources,
  recentCastSources,
  selectInspirationSources,
  type ComposeInspirationSource,
} from '@/lib/compose-inspiration';

describe('compose inspiration', () => {
  const note: ComposeInspirationSource = {
    id: 'note-1',
    kind: 'note',
    label: 'From your notes',
    headline: 'Wallet safety',
    title: 'Wallet safety',
    text: 'Explain why a recovery phrase should never be shared.',
  };

  it('normalizes recent casts and skips replies', () => {
    const sources = recentCastSources([
      { hash: '0x1', text: 'A new way to explain decentralized identity', author: { username: 'homie' } },
      { hash: '0x2', text: 'This is a reply', parent_hash: '0xparent' },
    ]);

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ id: 'cast-0x1', kind: 'recent_cast', authorUsername: 'homie' });
  });

  it('distinguishes regular notes from saved-cast notes', () => {
    const sources = noteSources([
      { id: '1', content: 'My own idea', tags: [] },
      { id: '2', content: 'A cast worth revisiting', tags: ['saved-cast'] },
    ]);

    expect(sources.map((source) => source.label)).toEqual(['From your notes', 'From a saved cast']);
  });

  it('builds a reaction source without losing its context', () => {
    expect(reactionSources([{
      type: 'like',
      castHash: '0x3',
      authorFid: 12,
      authorUsername: 'builder',
      text: 'Community ownership changes incentives.',
      channelId: 'farcaster',
      reactedAt: new Date().toISOString(),
    }])[0]).toMatchObject({ kind: 'reaction', authorUsername: 'builder', channelId: 'farcaster' });
  });

  it('rotates one idea from each available source group', () => {
    const first = { ...note, id: 'first' };
    const second = { ...note, id: 'second' };
    expect(selectInspirationSources([[first, second], []], 1)).toEqual([second]);
  });

  it('normalizes AI drafts and falls back when output is unusable', () => {
    expect(parseComposeDrafts({ drafts: [' First draft ', 'First draft', 'Second draft'] }, note))
      .toEqual(['First draft', 'Second draft']);
    expect(parseComposeDrafts({ drafts: [] }, note)).toEqual(fallbackComposeDrafts(note));
  });
});
