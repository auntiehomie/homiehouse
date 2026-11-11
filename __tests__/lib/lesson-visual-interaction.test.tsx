import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LessonIllustration from '@/components/learning/LessonIllustration';

describe('lesson visual interaction', () => {
  it('offers accessible, content-specific steps for a grounded sequence', () => {
    const text = 'Borrow tokens, swap tokens, and repay tokens.';
    const visual = { source: text, layout: 'sequence' as const, labels: ['Borrow tokens', 'swap tokens', 'repay tokens'] };
    const html = renderToStaticMarkup(<LessonIllustration text={text} visual={visual} />);
    expect(html).toContain('Explore visual steps');
    expect(html).toContain('1. Borrow tokens');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('prefers-reduced-motion:reduce');
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
    expect(html).toContain('aria-hidden="true"');
  });
});
