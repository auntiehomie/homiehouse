import { extractJsonObject, repairStoryboard } from "@/lib/lesson-storyboard";
import { normalizeLessonScenes } from "@/lib/lesson-scene";

const card =
  "A workflow prescribes every step in advance; an agent observes the environment and chooses which tools to call next.";

// The kind of plan a model actually returns: close to the spec, but not exact.
const sloppy = {
  source: card.replace(";", ";").replace("next.", "next"),
  layout: "storyboard",
  actors: [
    { id: "Workflow_Script", label: "Workflow", shape: "document" },
    { id: "agent", label: "Agent", shape: "Person" },
    {
      id: "tools",
      label: "Tools the agent can choose from right now",
      shape: "toolbox",
    },
  ],
  frames: [
    {
      narration: "A workflow lists every step before it runs.",
      states: [
        {
          id: "Workflow_Script",
          x: 5,
          y: 50,
          amount: 3,
          visible: true,
          tone: "neutral",
        },
        {
          id: "agent",
          x: 50,
          y: 50,
          amount: 1,
          visible: false,
          tone: "neutral",
        },
        {
          id: "tools",
          x: 95,
          y: 90,
          amount: 2.6,
          visible: true,
          tone: "neutral",
        },
      ],
    },
    {
      narration: "Nothing moves here.",
      states: [
        {
          id: "Workflow_Script",
          x: 5,
          y: 50,
          amount: 3,
          visible: true,
          tone: "neutral",
        },
        {
          id: "agent",
          x: 50,
          y: 50,
          amount: 1,
          visible: false,
          tone: "neutral",
        },
        {
          id: "tools",
          x: 95,
          y: 90,
          amount: 2.6,
          visible: true,
          tone: "neutral",
        },
      ],
    },
    {
      narration: "An agent appears and observes its environment.",
      states: [
        { id: "agent", x: 50, y: 50, amount: 1, visible: true, tone: "good" },
      ],
    },
    {
      narration:
        "It picks which tool to call next based on what it saw.".repeat(5),
      states: [
        {
          id: "Workflow_Script",
          x: 20,
          y: 50,
          amount: 3,
          visible: true,
          tone: "neutral",
        },
        {
          id: "agent",
          x: "70",
          y: 50,
          amount: 2,
          visible: "true",
          tone: "GOOD",
        },
        { id: "tools", x: 80, y: 60, amount: 1, visible: true, tone: "good" },
      ],
    },
  ],
};

describe("repairStoryboard", () => {
  it("turns a near-miss model plan into a valid animation for the exact card", () => {
    const plan = repairStoryboard(sloppy, card)!;
    expect(plan).toBeDefined();
    expect(plan.source).toBe(card);
    expect(plan.actors.map((a) => a.id)).toEqual([
      "workflow-script",
      "agent",
      "tools",
    ]);
    expect(plan.actors[2]).toEqual({
      id: "tools",
      label: expect.stringMatching(/…$/),
      shape: "block",
    });
    expect(plan.frames).toHaveLength(3);
    expect(plan.frames[0].narration).toContain("Nothing moves here.");
    expect(plan.frames[0].states.find((s) => s.id === "tools")).toMatchObject({
      x: 92,
      y: 80,
      amount: 3,
    });
    expect(plan.frames.every((f) => f.narration.length <= 220)).toBe(true);
    // Re-validates on the client exactly as the API response does.
    expect(normalizeLessonScenes([plan], card)).toEqual([plan]);
  });

  it("still rejects a plan written for a different card", () => {
    expect(
      repairStoryboard(
        { ...sloppy, source: "Wallets sign transactions with a private key." },
        card,
      ),
    ).toBeUndefined();
  });

  it("rejects plans too thin to animate", () => {
    expect(
      repairStoryboard({ ...sloppy, actors: sloppy.actors.slice(0, 1) }, card),
    ).toBeUndefined();
    expect(
      repairStoryboard({ ...sloppy, frames: sloppy.frames.slice(0, 2) }, card),
    ).toBeUndefined();
  });
});

describe("extractJsonObject", () => {
  it("reads JSON wrapped in fences or prose", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(
      extractJsonObject('Here is the plan:\n{"a":{"b":2}}\nHope this helps!'),
    ).toEqual({ a: { b: 2 } });
    expect(extractJsonObject("no json here")).toBeUndefined();
  });
});
