import { containsInternalReasoning, finalCastOnly } from '@/lib/agent-post';

describe('final cast output guard', () => {
  it('returns only the finished cast text', () => {
    expect(finalCastOnly('Cast: ZK rollups bundle transactions and prove the result.')).toBe(
      'ZK rollups bundle transactions and prove the result.',
    );
  });

  it.each(['# Standalone Educational Post', '## standalone educational post ##', '#StandaloneEducationalPost'])(
    'strips the draft label before applying the character limit: %s',
    (label) => {
      const body = 'Cryptographic keys can unlock a smart lock.';
      expect(finalCastOnly(`${label}\r\n\r\n${body}`, body.length)).toBe(body);
      expect(finalCastOnly(label)).toBe('');
    },
  );

  it('strips the draft label and hashtags from a thread', () => {
    const first = 'Cryptographic keys can unlock a smart lock.';
    const second = 'Keep a recovery method.';
    expect(finalCastOnly(`${first} #Cryptography\n---\n# Standalone Educational Post\n${second} #Recovery`, 640)).toBe(
      `${first}\n---\n\n${second}`,
    );
  });

  it('strips hashtags before applying the limit and preserves URL fragments', () => {
    const body = 'Read https://example.org/docs#recovery for details.';
    expect(finalCastOnly(`#Crypto Read https://example.org/docs#recovery #安全 for details. ＃Web3`, body.length)).toBe(body);
    expect(finalCastOnly('#Crypto #Web3')).toBe('');
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
