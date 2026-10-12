import { buildPostSystem, pickKnowledgePostMode, postInstruction, type PostMode } from '@/lib/ai/persona';

describe('knowledge-grounded educational posting', () => {
  afterEach(() => jest.restoreAllMocks());

  it('selects only grounded teaching modes across the full random range', () => {
    const selected = new Set<PostMode>();
    for (let i = 0; i < 100; i++) {
      jest.spyOn(Math, 'random').mockReturnValue((i + 0.5) / 100);
      const chosen = pickKnowledgePostMode();
      expect(chosen.needsKB).toBe(true);
      expect(chosen.needsTrend).toBe(false);
      expect(chosen.needsNews).toBe(false);
      selected.add(chosen.mode);
    }
    expect(selected).toEqual(new Set(['tip', 'question', 'culture', 'deep-dive']));
  });

  it.each<PostMode>(['tip', 'question', 'culture', 'deep-dive'])('avoids consecutive %s posts', (previous) => {
    for (const roll of [0, 0.35, 0.7, 0.999]) {
      jest.spyOn(Math, 'random').mockReturnValue(roll);
      expect(pickKnowledgePostMode(previous).mode).not.toBe(previous);
    }
  });

  it.each<PostMode>(['tip', 'question', 'culture', 'deep-dive'])('supplies article evidence to %s drafts', (mode) => {
    const prompt = postInstruction(mode, {
      kbArticle: { title: 'Portable identity', summary: 'Accounts can move across apps.', learningPoints: ['Check portability limits.'], url: 'https://example.org/identity' },
    });
    expect(prompt).toContain('Accounts can move across apps.');
    expect(prompt).toContain('Check portability limits.');
    expect(prompt).toContain('https://example.org/identity');
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('homiehouse.app/learn');
  });

  it('gives X a complete single-tweet brief and retains Farcaster long explanations', () => {
    const kbArticle = { title: 'AI agents', summary: 'Agents use tools within permissions.' };
    expect(buildPostSystem('', 'x')).toContain('X (Twitter)');
    expect(postInstruction('deep-dive', { kbArticle, platform: 'x' })).toContain('one complete standalone tweet, max 280 chars');
    expect(postInstruction('deep-dive', { kbArticle })).toContain('up to 640 characters');
    expect(postInstruction('culture', { kbArticle, platform: 'x' })).toContain('Max 280 chars');
    expect(postInstruction('tip', { kbArticle, promoteLearning: true })).toContain('https://homiehouse.app/learn');
  });
});
