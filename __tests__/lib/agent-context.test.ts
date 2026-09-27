import {
  extractCastText,
  extractMentionContent,
  normalizeCastText,
  shouldSearchWeb,
} from '@/lib/agent-context';

describe('agent context input normalization', () => {
  it('reads both normalized and legacy cast text shapes', () => {
    expect(extractCastText({ text: 'A normal cast' })).toBe('A normal cast');
    expect(extractCastText({ cast_info: { text: 'Legacy cast body' } })).toBe('Legacy cast body');
  });

  it('rejects missing, object, and literal undefined payload values', () => {
    expect(normalizeCastText(undefined)).toBe('');
    expect(normalizeCastText({ text: 'not a string' })).toBe('');
    expect(normalizeCastText('undefined.')).toBe('');
    expect(extractCastText({ text: 'null' })).toBe('');
  });

  it('strips the bot mention and skips a mention with no actual message', () => {
    expect(extractMentionContent({ text: '@thehomie what is a DAO?' })).toBe('what is a DAO?');
    expect(extractMentionContent({ text: '@thehomie' })).toBe('');
  });

  it('requests web context for questions and current-information requests only', () => {
    expect(shouldSearchWeb('What is GENY?')).toBe(true);
    expect(shouldSearchWeb('Any latest update on Farcaster?')).toBe(true);
    expect(shouldSearchWeb('gm everyone')).toBe(false);
  });
});
