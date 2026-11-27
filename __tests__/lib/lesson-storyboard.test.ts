import { normalizeLessonScenes } from '@/lib/lesson-scene';
import { storyboardForText } from '@/lib/lesson-storyboard';

const text = 'The cost of attacking the chain exceeds the reward.';
const plan = storyboardForText(text)!;

describe('explanatory storyboards', () => {
  it('animates the exact attack-cost claim with accumulating costs and a stable reward', () => {
    expect(normalizeLessonScenes([plan], text)).toEqual([plan]);
    const costs = plan.frames.map(frame => frame.states.find(s => s.id === 'cost')!.amount);
    expect(costs).toEqual([1, 3, 5, 5]);
    expect(plan.frames.every(frame => frame.states.find(s => s.id === 'reward')!.amount === 2)).toBe(true);
    expect(storyboardForText('An attacker can gain a reward.')).toBeUndefined();
    expect(storyboardForText('The cost of attacking does not exceed the reward.')).toBeUndefined();
    expect(storyboardForText(text + ' Nodes also validate signatures.')).toBeUndefined();
  });
  it('rejects a storyboard attached to another card', () => {
    expect(normalizeLessonScenes([plan], 'Wallets sign transactions.')).toEqual([]);
  });
  it('rejects label-only frames without physical state changes', () => {
    const staticFrames = plan.frames.map(frame => ({ ...frame, states: plan.frames[0].states }));
    expect(normalizeLessonScenes([{ ...plan, frames: staticFrames }], text)).toEqual([]);
  });
  it.each([
    { ...plan, actors: [plan.actors[0], plan.actors[0]] },
    { ...plan, frames: [{ ...plan.frames[0], states: [] }, ...plan.frames.slice(1)] },
    { ...plan, actors: plan.actors.map(actor => ({ ...actor, shape: '<script>' })) },
    { ...plan, frames: plan.frames.map(frame => ({ ...frame, states: frame.states.map(state => ({ ...state, x: Infinity })) })) },
  ])('rejects unsafe or incomplete animation data', invalid => {
    expect(normalizeLessonScenes([invalid], text)).toEqual([]);
  });
});
