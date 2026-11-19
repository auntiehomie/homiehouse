export type AnimatedActor = { id: string; label: string; shape: 'coin' | 'block' | 'person' | 'document' | 'shield' | 'bar' };
export type ActorState = { id: string; x: number; y: number; amount: number; visible: boolean; tone: 'neutral' | 'good' | 'bad' };
export type LessonStoryboard = { source: string; layout: 'storyboard'; actors: AnimatedActor[]; frames: { narration: string; states: ActorState[] }[] };

export const STORYBOARD_INSTRUCTIONS = `Use layout "storyboard" to explain the mechanism of the exact card text through a timed animation. Return {source,layout,actors,frames}. source copies the complete input text verbatim. actors is 2-6 objects {id,label,shape}, label at most 36 characters, shape coin|block|person|document|shield|bar. frames is 3-6 ordered objects {narration,states}. Narration at most 220 characters explains what changes and why, grounded in the input. Every frame states every actor as {id,x,y,amount,visible,tone}. x is 8-92, y is 15-80, amount is 1-5, visible is boolean, tone neutral|good|bad. Demonstrate every point in the card with meaningful motion and state changes: transactions travel, competing spends are rejected, copies distribute, documents transform, costs accumulate, permissions block an action. Use spatial relationships and object quantities, not a row of boxes with changing words. Each consecutive frame must change position, amount, or visibility of an actor. For bars amount controls height. Amounts are illustrative, never invented real measurements. End with the outcome and its reason. Never invent facts or promise outcomes that the text does not support. No code, URLs or markup.`;

export function normalizeStoryboard(value: Record<string, unknown>, explanation: string): LessonStoryboard | undefined {
  if (typeof value.source !== 'string' || value.source.length < 10 || value.source.length > 2000 || !explanation.includes(value.source)) return;
  if (!Array.isArray(value.actors) || value.actors.length < 2 || value.actors.length > 6 || !Array.isArray(value.frames) || value.frames.length < 3 || value.frames.length > 6) return;
  const actors: AnimatedActor[] = [];
  for (const actor of value.actors) {
    if (!actor || typeof actor.id !== 'string' || !/^[a-z][a-z0-9-]{0,20}$/.test(actor.id) || actors.some(a => a.id === actor.id) || typeof actor.label !== 'string' || !actor.label.trim() || actor.label.length > 36 || !['coin', 'block', 'person', 'document', 'shield', 'bar'].includes(actor.shape)) return;
    actors.push({ id: actor.id, label: actor.label, shape: actor.shape });
  }
  const frames: LessonStoryboard['frames'] = [];
  for (const frame of value.frames) {
    if (!frame || typeof frame.narration !== 'string' || !frame.narration.trim() || frame.narration.length > 220 || !Array.isArray(frame.states) || frame.states.length !== actors.length) return;
    const states: ActorState[] = [];
    for (const state of frame.states) {
      if (!state || !actors.some(a => a.id === state.id) || states.some(s => s.id === state.id) || !Number.isFinite(state.x) || state.x < 8 || state.x > 92 || !Number.isFinite(state.y) || state.y < 15 || state.y > 80 || !Number.isInteger(state.amount) || state.amount < 1 || state.amount > 5 || typeof state.visible !== 'boolean' || !['neutral', 'good', 'bad'].includes(state.tone)) return;
      states.push({ id: state.id, x: state.x, y: state.y, amount: state.amount, visible: state.visible, tone: state.tone });
    }
    const previous = frames.at(-1);
    if (previous && !states.some(s => { const p = previous.states.find(p => p.id === s.id)!; return s.x !== p.x || s.y !== p.y || s.amount !== p.amount || s.visible !== p.visible; })) return;
    frames.push({ narration: frame.narration, states });
  }
  return { source: value.source, layout: 'storyboard', actors, frames };
}

/** A qualitative illustration of the exact economic claim, without predicting attack success. */
export function storyboardForText(text: string): LessonStoryboard | undefined {
  if ((text.match(/[.!?](?:\s|$)/g)?.length ?? 0) > 1 || !/attack/i.test(text)
    || !/\bcost[\s\S]{0,80}\b(?:exceeds?|outweighs?|is greater than|is more than)\b[\s\S]{0,40}\b(?:reward|gain|profit)/i.test(text)
    || /does(?:n't| not)|not exceed|not outweigh/i.test(text)) return;
  const state = (id: string, x: number, amount: number, tone: ActorState['tone'] = 'neutral'): ActorState => ({ id, x, y: 65, amount, tone, visible: true });
  return { source: text, layout: 'storyboard', actors: [
    { id: 'cost', label: 'Attack cost', shape: 'bar' }, { id: 'reward', label: 'Possible reward', shape: 'bar' }, { id: 'resources', label: 'Resources spent', shape: 'coin' },
  ], frames: [
    { narration: 'Compare the resources an attack consumes with the reward it could bring. These sizes are illustrative.', states: [state('cost', 25, 1), state('reward', 76, 2, 'good'), { ...state('resources', 50, 1), y: 25 }] },
    { narration: 'The attacker spends resources. The cost grows as those resources are consumed.', states: [state('cost', 25, 3), state('reward', 76, 2, 'good'), state('resources', 25, 2)] },
    { narration: 'In the situation this card describes, the attack cost exceeds the possible reward.', states: [state('cost', 25, 5, 'bad'), state('reward', 76, 2, 'good'), { ...state('resources', 25, 2), visible: false }] },
    { narration: 'The difference is a loss to the attacker. That economic incentive is the game-theory point made here.', states: [state('cost', 30, 5, 'bad'), state('reward', 70, 2, 'good'), { ...state('resources', 25, 2), visible: false }] },
  ] };
}
