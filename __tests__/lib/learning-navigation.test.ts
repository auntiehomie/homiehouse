import {
  buildLearningModuleReturnTo,
  resolveComposeReturnDestination,
} from '@/lib/learning-navigation';

describe('learning share navigation', () => {
  it('builds a return route to the exact lesson module', () => {
    expect(buildLearningModuleReturnTo('zk-rollups')).toBe('/learn/module?id=zk-rollups');
    expect(buildLearningModuleReturnTo('topic / crypto')).toBe('/learn/module?id=topic%20%2F%20crypto');
  });

  it('allows returning to the exact lesson route and legacy learning hub route', () => {
    expect(resolveComposeReturnDestination('/learn/module?id=zk-rollups')).toBe('/learn/module?id=zk-rollups');
    expect(resolveComposeReturnDestination('/learn')).toBe('/learn');
  });

  it('preserves Ask Homie returns and rejects unknown destinations', () => {
    expect(resolveComposeReturnDestination('/ask-homie?cast=abc')).toBe('/ask-homie?cast=abc');
    expect(resolveComposeReturnDestination('https://example.com')).toBeNull();
    expect(resolveComposeReturnDestination('//example.com')).toBeNull();
    expect(resolveComposeReturnDestination('/learn/untrusted')).toBeNull();
  });
});
