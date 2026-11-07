import { lessonIllustrationTopic } from '@/components/learning/LessonIllustration';

describe('lesson illustration selection', () => {
  it.each([
    ['A waiter takes money before the customer bill is final', 'restaurant'],
    ['Reentrancy repeatedly calls withdraw', 'reentrancy'],
    ['A flash loan borrows, swaps and repays', 'flash-loan'],
    ['A multisig wallet needs multiple approvals', 'multisig'],
    ['Keep your seed phrase offline', 'seed'],
    ['An agent observes chain data, evaluates it, and executes transactions', 'agent-loop'],
    ['A trader watches market prices and decides whether to buy or sell', 'trader'],
    ['A restaurant menu with five dishes is simpler than a 50-page menu for customers', 'menu'],
    ['An unrelated AI concept', null],
  ] as const)('selects a matching scene for %s', (text, expected) => {
    expect(lessonIllustrationTopic(text)).toBe(expected);
  });
});
