jest.mock('@/components/learning/LessonAnimation.module.css', () => ({}));
jest.mock('@/components/learning/LessonActivity.module.css', () => ({}));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LessonIllustration from '@/components/learning/LessonIllustration';
import { storyboardForText } from '@/lib/lesson-storyboard';

it('replaces a legacy comparison on the reported card with an animated explanation', () => {
  const text = 'The cost of attacking the chain exceeds the reward.';
  const markup = renderToStaticMarkup(createElement(LessonIllustration, { text, visual: { source: text, layout: 'comparison', labels: ['cost', 'reward'] } }));
  expect(markup).toContain('Animated explanation');
  expect(markup).toContain('data-actor="resources"');
  expect(markup).toContain('Play');
  expect(markup).not.toContain('lesson-scene');
});

it('preserves the dedicated interactive block-link scene from master', () => {
  const text = 'Each block contains the hash of the previous block, linking the chain.';
  const markup = renderToStaticMarkup(createElement(LessonIllustration, { text }));
  expect(markup).toContain('Edit old transaction');
});

it('does not reuse a partial storyboard for a card containing additional points', () => {
  const source = 'The cost of attacking the chain exceeds the reward.';
  const visual = { ...storyboardForText(source)!, source };
  const markup = renderToStaticMarkup(createElement(LessonIllustration, { text: source + ' Nodes also validate signatures.', visual }));
  expect(markup).not.toContain('data-actor="resources"');
});
