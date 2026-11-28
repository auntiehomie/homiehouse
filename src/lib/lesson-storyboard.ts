export type AnimatedActor = {
  id: string;
  label: string;
  shape: "coin" | "block" | "person" | "document" | "shield" | "bar";
};
export type ActorState = {
  id: string;
  x: number;
  y: number;
  amount: number;
  visible: boolean;
  tone: "neutral" | "good" | "bad";
};
export type LessonStoryboard = {
  source: string;
  layout: "storyboard";
  actors: AnimatedActor[];
  frames: { narration: string; states: ActorState[] }[];
};

export const STORYBOARD_INSTRUCTIONS = `Use layout "storyboard" to explain the mechanism of the exact card text through a timed animation. Return {source,layout,actors,frames}. source copies the complete input text verbatim. actors is 2-6 objects {id,label,shape}, label at most 36 characters, shape coin|block|person|document|shield|bar. frames is 3-6 ordered objects {narration,states}. Narration at most 220 characters explains what changes and why, grounded in the input. Every frame states every actor as {id,x,y,amount,visible,tone}. x is 8-92, y is 15-80, amount is 1-5, visible is boolean, tone neutral|good|bad. Demonstrate every point in the card with meaningful motion and state changes: transactions travel, competing spends are rejected, copies distribute, documents transform, costs accumulate, permissions block an action. Use spatial relationships and object quantities, not a row of boxes with changing words. Each consecutive frame must change position, amount, or visibility of an actor. For bars amount controls height. Amounts are illustrative, never invented real measurements. End with the outcome and its reason. Never invent facts or promise outcomes that the text does not support. No code, URLs or markup.`;

export function normalizeStoryboard(
  value: Record<string, unknown>,
  explanation: string,
): LessonStoryboard | undefined {
  if (
    typeof value.source !== "string" ||
    value.source.length < 10 ||
    value.source.length > 2000 ||
    !explanation.includes(value.source)
  )
    return;
  if (
    !Array.isArray(value.actors) ||
    value.actors.length < 2 ||
    value.actors.length > 6 ||
    !Array.isArray(value.frames) ||
    value.frames.length < 3 ||
    value.frames.length > 6
  )
    return;
  const actors: AnimatedActor[] = [];
  for (const actor of value.actors) {
    if (
      !actor ||
      typeof actor.id !== "string" ||
      !/^[a-z][a-z0-9-]{0,20}$/.test(actor.id) ||
      actors.some((a) => a.id === actor.id) ||
      typeof actor.label !== "string" ||
      !actor.label.trim() ||
      actor.label.length > 36 ||
      !["coin", "block", "person", "document", "shield", "bar"].includes(
        actor.shape,
      )
    )
      return;
    actors.push({ id: actor.id, label: actor.label, shape: actor.shape });
  }
  const frames: LessonStoryboard["frames"] = [];
  for (const frame of value.frames) {
    if (
      !frame ||
      typeof frame.narration !== "string" ||
      !frame.narration.trim() ||
      frame.narration.length > 220 ||
      !Array.isArray(frame.states) ||
      frame.states.length !== actors.length
    )
      return;
    const states: ActorState[] = [];
    for (const state of frame.states) {
      if (
        !state ||
        !actors.some((a) => a.id === state.id) ||
        states.some((s) => s.id === state.id) ||
        !Number.isFinite(state.x) ||
        state.x < 8 ||
        state.x > 92 ||
        !Number.isFinite(state.y) ||
        state.y < 15 ||
        state.y > 80 ||
        !Number.isInteger(state.amount) ||
        state.amount < 1 ||
        state.amount > 5 ||
        typeof state.visible !== "boolean" ||
        !["neutral", "good", "bad"].includes(state.tone)
      )
        return;
      states.push({
        id: state.id,
        x: state.x,
        y: state.y,
        amount: state.amount,
        visible: state.visible,
        tone: state.tone,
      });
    }
    const previous = frames.at(-1);
    if (
      previous &&
      !states.some((s) => {
        const p = previous.states.find((p) => p.id === s.id)!;
        return (
          s.x !== p.x ||
          s.y !== p.y ||
          s.amount !== p.amount ||
          s.visible !== p.visible
        );
      })
    )
      return;
    frames.push({ narration: frame.narration, states });
  }
  return { source: value.source, layout: "storyboard", actors, frames };
}

/** A qualitative illustration of the exact economic claim, without predicting attack success. */
export function storyboardForText(text: string): LessonStoryboard | undefined {
  if (
    (text.match(/[.!?](?:\s|$)/g)?.length ?? 0) > 1 ||
    !/attack/i.test(text) ||
    !/\bcost[\s\S]{0,80}\b(?:exceeds?|outweighs?|is greater than|is more than)\b[\s\S]{0,40}\b(?:reward|gain|profit)/i.test(
      text,
    ) ||
    /does(?:n't| not)|not exceed|not outweigh/i.test(text)
  )
    return;
  const state = (
    id: string,
    x: number,
    amount: number,
    tone: ActorState["tone"] = "neutral",
  ): ActorState => ({ id, x, y: 65, amount, tone, visible: true });
  return {
    source: text,
    layout: "storyboard",
    actors: [
      { id: "cost", label: "Attack cost", shape: "bar" },
      { id: "reward", label: "Possible reward", shape: "bar" },
      { id: "resources", label: "Resources spent", shape: "coin" },
    ],
    frames: [
      {
        narration:
          "Compare the resources an attack consumes with the reward it could bring. These sizes are illustrative.",
        states: [
          state("cost", 25, 1),
          state("reward", 76, 2, "good"),
          { ...state("resources", 50, 1), y: 25 },
        ],
      },
      {
        narration:
          "The attacker spends resources. The cost grows as those resources are consumed.",
        states: [
          state("cost", 25, 3),
          state("reward", 76, 2, "good"),
          state("resources", 25, 2),
        ],
      },
      {
        narration:
          "In the situation this card describes, the attack cost exceeds the possible reward.",
        states: [
          state("cost", 25, 5, "bad"),
          state("reward", 76, 2, "good"),
          { ...state("resources", 25, 2), visible: false },
        ],
      },
      {
        narration:
          "The difference is a loss to the attacker. That economic incentive is the game-theory point made here.",
        states: [
          state("cost", 30, 5, "bad"),
          state("reward", 70, 2, "good"),
          { ...state("resources", 25, 2), visible: false },
        ],
      },
    ],
  };
}

const SHAPES: AnimatedActor["shape"][] = [
  "coin",
  "block",
  "person",
  "document",
  "shield",
  "bar",
];
const TONES: ActorState["tone"][] = ["neutral", "good", "bad"];

function comparable(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "")
    .toLowerCase();
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, "")}…`;
}

function num(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/**
 * Pull the first JSON object out of a model reply that may include fences or
 * a sentence of prose around it.
 */
export function extractJsonObject(reply: string): unknown {
  const trimmed = reply
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/**
 * Models rarely hit every bound of STORYBOARD_INSTRUCTIONS exactly (an x of 95,
 * an amount of 2.5, a 230-character narration, a "Bitcoin_Node" id, a source
 * with curly quotes). The strict validator then rejected the whole animation
 * and the card showed only "Retry animated explanation". This repairs those
 * cosmetic deviations into the documented bounds. It never changes meaning:
 * a source that is a different card is still rejected, and the result must
 * still pass normalizeStoryboard.
 */
export function repairStoryboard(
  raw: unknown,
  cardText: string,
): LessonStoryboard | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const value = raw as Record<string, unknown>;
  const text = cardText.trim();
  if (
    value.source !== undefined &&
    (typeof value.source !== "string" ||
      comparable(value.source) !== comparable(text))
  )
    return;
  if (!Array.isArray(value.actors) || !Array.isArray(value.frames)) return;

  const idMap = new Map<string, string>();
  const actors: AnimatedActor[] = [];
  for (const actor of value.actors.slice(0, 6)) {
    if (!actor || typeof actor !== "object") continue;
    const a = actor as Record<string, unknown>;
    const rawId =
      typeof a.id === "string" || typeof a.id === "number" ? String(a.id) : "";
    let id = rawId
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^[^a-z]+/, "")
      .replace(/-+$/, "")
      .slice(0, 21);
    if (!id) id = `actor-${actors.length + 1}`;
    while (actors.some((existing) => existing.id === id))
      id = `${id.slice(0, 18)}-${actors.length + 1}`;
    const label = typeof a.label === "string" ? clip(a.label, 36) : "";
    if (!label) continue;
    const shape =
      typeof a.shape === "string" &&
      SHAPES.includes(a.shape.toLowerCase() as AnimatedActor["shape"])
        ? (a.shape.toLowerCase() as AnimatedActor["shape"])
        : "block";
    if (rawId) idMap.set(rawId, id);
    actors.push({ id, label, shape });
  }
  if (actors.length < 2) return;

  const frames: LessonStoryboard["frames"] = [];
  for (const frame of value.frames) {
    if (frames.length >= 6) break;
    if (!frame || typeof frame !== "object") continue;
    const f = frame as Record<string, unknown>;
    const narration =
      typeof f.narration === "string" ? clip(f.narration, 220) : "";
    if (!narration || !Array.isArray(f.states)) continue;
    const previous = frames.at(-1);
    const states: ActorState[] = actors.map((actor, index) => {
      const match = (f.states as unknown[]).find((s) => {
        if (!s || typeof s !== "object") return false;
        const sid = (s as Record<string, unknown>).id;
        return (
          (typeof sid === "string" || typeof sid === "number") &&
          idMap.get(String(sid)) === actor.id
        );
      }) as Record<string, unknown> | undefined;
      const prior = previous?.states.find((s) => s.id === actor.id);
      const fallback: ActorState = prior ?? {
        id: actor.id,
        x: Math.round(8 + (84 * (index + 0.5)) / actors.length),
        y: 50,
        amount: 1,
        visible: true,
        tone: "neutral",
      };
      if (!match) return { ...fallback };
      const x = num(match.x);
      const y = num(match.y);
      const amount = num(match.amount);
      const tone =
        typeof match.tone === "string" &&
        TONES.includes(match.tone.toLowerCase() as ActorState["tone"])
          ? (match.tone.toLowerCase() as ActorState["tone"])
          : fallback.tone;
      const visible =
        typeof match.visible === "boolean"
          ? match.visible
          : match.visible === "false"
            ? false
            : match.visible === "true"
              ? true
              : fallback.visible;
      return {
        id: actor.id,
        x: x === undefined ? fallback.x : Math.min(92, Math.max(8, x)),
        y: y === undefined ? fallback.y : Math.min(80, Math.max(15, y)),
        amount:
          amount === undefined
            ? fallback.amount
            : Math.min(5, Math.max(1, Math.round(amount))),
        visible,
        tone,
      };
    });
    // A frame that changes nothing on stage would stall the animation; keep
    // its narration by folding it into the previous frame instead.
    if (
      previous &&
      !states.some((s) => {
        const p = previous.states.find((ps) => ps.id === s.id)!;
        return (
          s.x !== p.x ||
          s.y !== p.y ||
          s.amount !== p.amount ||
          s.visible !== p.visible
        );
      })
    ) {
      if (previous.narration.length + narration.length + 1 <= 220)
        previous.narration = `${previous.narration} ${narration}`;
      continue;
    }
    frames.push({ narration, states });
  }
  if (frames.length < 3) return;
  return normalizeStoryboard(
    { source: text, layout: "storyboard", actors, frames },
    text,
  );
}
