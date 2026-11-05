import { containsInternalReasoning, finalCastOnly } from '@/lib/agent-post';

describe('final cast output guard', () => {
  it('returns only the finished cast text', () => {
    expect(finalCastOnly('Cast: ZK rollups bundle transactions and prove the result.')).toBe(
      'ZK rollups bundle transactions and prove the result.',
    );
  });

  it.each([
    'Reasoning: I should explain this simply.\n\nZK rollups bundle transactions.',
    'Let me think through this carefully. The user is asking for a cast.',
    '<analysis>We need to write a post.</analysis>',
    'A useful cast.\n\nPlanning notes: explain the benefit first.',
  ])('rejects reasoning and drafting text: %s', (output) => {
    expect(containsInternalReasoning(output)).toBe(true);
    expect(finalCastOnly(output)).toBe('');
  });

  it('does not reject normal educational cast text', () => {
    expect(finalCastOnly('ZK rollups use proofs to help scale Ethereum.')).toBe(
      'ZK rollups use proofs to help scale Ethereum.',
    );
  });
});
