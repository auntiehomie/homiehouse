jest.mock('@/components/learning/LessonAnimation.module.css', () => ({}));
jest.mock('@/components/learning/LessonActivity.module.css', () => ({}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LessonIllustration from '@/components/learning/LessonIllustration';

describe('lesson visual interaction', () => {
  it.each([
    ['A sandbox verifies read-only permissions.', 'Try a read-only sandbox'],
    ['Trace indirect prompt injection.', 'Trace the input'],
    ['Ethereum transaction nonce ordering.', 'Order two transactions'],
  ])('preserves the newer activity for %s', (text, heading) => {
    const html = renderToStaticMarkup(<LessonIllustration text={text} />);
    expect(html).toContain(heading);
    expect(html).not.toContain('Interactive tokenizer');
  });

  it('requests a motion storyboard for an older label-only sequence', () => {
    const text = 'Borrow tokens, swap tokens, and repay tokens.';
    const visual = { source: text, layout: 'sequence' as const, labels: ['Borrow tokens', 'swap tokens', 'repay tokens'] };
    const html = renderToStaticMarkup(<LessonIllustration text={text} visual={visual} />);
    expect(html).toContain('Retry animated explanation');
    expect(html).not.toContain('Explore visual steps');
  });
  it('replaces the cached generic tokenization diagram with the interactive tokenizer', () => {
    const text = "Models read tokens, chunks of text encoded as numbers.";
    const visual = { source: text, layout: 'sequence' as const, labels: ['text', 'tokens', 'numbers'] };
    const html = renderToStaticMarkup(<LessonIllustration text={text} visual={visual} />);
    expect(html).toContain('Interactive tokenizer');
    expect(html).toContain('Text to tokenize');
    expect(html).toContain('Predict where the text will split');
    expect(html).not.toContain('Explore visual steps');
  });
  it('uses a grounded example from a generated tokenization scene', () => {
    const text = 'Language models split text into tokens.';
    const visual = { source: text, layout: 'tokenization' as const, sample: 'Hello, world!' };
    const html = renderToStaticMarkup(<LessonIllustration text={text} visual={visual} />);
    expect(html).toContain('Hello, world!');
  });
  it('does not invent an interactive sequence for a comparison', () => {
    const text = 'Compare public networks with private networks.';
    const visual = { source: text, layout: 'comparison' as const, labels: ['public networks', 'private networks'] };
    const html = renderToStaticMarkup(<LessonIllustration text={text} visual={visual} />);
    expect(html).not.toContain('Explore visual steps');
    expect(html).toContain('Retry animated explanation');
  });
});
