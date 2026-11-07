import { lessonIllustrationTopic } from '@/components/learning/LessonIllustration';

describe('lesson illustration topic', () => {
  it.each([
    ['Prevent a reentrancy attack', 'security'],
    ['AI agents and machine learning', 'ai'],
    ['DAO voting and community', 'community'],
    ['Ethereum tokens', 'money'],
    ['Decentralized storage nodes', 'network'],
    ['A new idea', 'ideas'],
  ] as const)('chooses a cue for %s', (text, expected) => {
    expect(lessonIllustrationTopic(text)).toBe(expected);
  });
});
