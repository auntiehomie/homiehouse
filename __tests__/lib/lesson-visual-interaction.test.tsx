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
  it('does not invent an interactive sequence for a comparison', () => {
    const text = 'Compare public networks with private networks.';
    const visual = { source: text, layout: 'comparison' as const, labels: ['public networks', 'private networks'] };
    const html = renderToStaticMarkup(<LessonIllustration text={text} visual={visual} />);
    expect(html).not.toContain('Explore visual steps');
    expect(html).toContain('aria-hidden="true"');
  });
});
