import {
  fallbackCurationSuggestions,
  findMatchingCurationRule,
  parseCurationSuggestions,
  type SavedCurationRule,
} from '@/lib/curation-suggestions';

describe('curation suggestions', () => {
  const cast = {
    text: 'A practical guide to account abstraction and smart wallets on Base',
    channelId: 'base',
    authorUsername: 'builder',
  };

  it('prefers an existing matching list in the local fallback', () => {
    expect(fallbackCurationSuggestions(cast, ['Base Builders'])[0]).toMatchObject({
      listName: 'Base Builders',
      channelId: 'base',
    });
  });

  it('normalizes AI output and removes duplicate destinations', () => {
    const result = parseCurationSuggestions({ suggestions: [
      { listName: 'Smart Wallets', reason: 'Account abstraction', keywords: ['Wallets', 'abstraction'] },
      { listName: 'smart wallets', reason: 'duplicate', keywords: [] },
      { listName: '', reason: 'invalid' },
    ] }, cast);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      listName: 'Smart Wallets',
      keywords: ['wallets', 'abstraction'],
    });
  });

  it('matches remembered rules by channel, author, or meaningful keyword', () => {
    const rules: SavedCurationRule[] = [{
      listName: 'Smart Wallets',
      reason: 'Useful wallet design',
      keywords: ['abstraction'],
      channelId: 'ethereum',
      createdAt: Date.now(),
    }];

    expect(findMatchingCurationRule(cast, rules)?.listName).toBe('Smart Wallets');
    expect(findMatchingCurationRule({ text: 'Unrelated short post' }, rules)).toBeNull();
  });

  it('does not broaden an AI rule with cast metadata the model omitted', () => {
    const result = parseCurationSuggestions({ suggestions: [{
      listName: 'Smart Wallets',
      reason: 'Account abstraction',
      keywords: ['abstraction'],
    }] }, cast);

    expect(result[0].channelId).toBeUndefined();
    expect(result[0].authorUsername).toBeUndefined();
  });
});
