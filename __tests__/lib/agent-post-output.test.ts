import { containsInternalReasoning, finalCastOnly, splitAgentCasts } from '@/lib/agent-post';
import { castTextBytes } from '@/lib/cast-text';

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

  it('keeps the full reply and splits it into standard casts at word boundaries', () => {
    const answer = 'A secure key can unlock a smart lock 🔑. '.repeat(35) + 'Keep a backup.';
    const cleaned = finalCastOnly(answer);
    const parts = splitAgentCasts(cleaned);
    expect(cleaned).toBe(answer);
    expect(parts.length).toBeGreaterThan(3);
    expect(parts.join(' ')).toBe(answer);
    expect(parts.every((part) => castTextBytes(part) <= 320)).toBe(true);
  });

  it('honors explicit thread breaks without treating inline dashes as separators', () => {
    expect(splitAgentCasts('A key---or another credential.\n---\nKeep a backup.')).toEqual([
      'A key---or another credential.',
      'Keep a backup.',
    ]);
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
