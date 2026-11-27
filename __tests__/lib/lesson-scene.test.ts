import { normalizeLessonScenes, sceneForExistingText, sceneForText } from '@/lib/lesson-scene';

describe('lesson animation plans', () => {
  const text = 'Decentralization distributes control across independent nodes.';
  const valid = { source: text, layout: 'network', labels: ['control', 'independent nodes'] };
  it('keeps grounded plans and finds them only on the matching card', () => {
    const plans = normalizeLessonScenes([valid], text);
    expect(plans).toEqual([valid]);
    expect(sceneForText(plans, text)).toEqual(valid);
    expect(sceneForText(plans, 'A different sentence.')).toBeUndefined();
  });
  it('rejects invented source text, labels and arbitrary layouts', () => {
    expect(normalizeLessonScenes([{ ...valid, source: 'A made up sentence' }, { ...valid, labels: ['evil', 'nodes'] }, { ...valid, layout: '<svg>' }], text)).toEqual([]);
  });
  it('shows a distributed network for the existing screenshot without inventing a sequence', () => {
    expect(sceneForExistingText('Decentralization is the dispersion of control and computation across many independent nodes.')?.layout).toBe('network');
    expect(sceneForExistingText('A recipe for soup.')).toBeUndefined();
  });
});
