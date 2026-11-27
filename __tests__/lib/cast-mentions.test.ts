import { castTextWithMentions, withMentionText } from "@/lib/cast-mentions";

describe("castTextWithMentions", () => {
  it("re-inserts a leading mention from Hypersnap zero-width ranges", () => {
    const cast = {
      text: ", welcome to the wider Farcaster! 🎉",
      mentioned_profiles: [{ fid: 42, username: "alice" }],
      mentioned_profiles_ranges: [{ start: 0, end: 0 }],
    };
    expect(castTextWithMentions(cast)).toBe(
      "@alice, welcome to the wider Farcaster! 🎉",
    );
  });

  it("uses UTF-8 byte offsets so emoji before a mention do not shift it", () => {
    // "🎉 hi " is 4 + 4 = 8 bytes
    const cast = {
      text: "🎉 hi  and  !",
      mentioned_profiles: [
        { fid: 1, username: "bob" },
        { fid: 2, username: "carol" },
      ],
      mentioned_profiles_ranges: [
        { start: 8, end: 8 },
        { start: 13, end: 13 },
      ],
    };
    expect(castTextWithMentions(cast)).toBe("🎉 hi @bob and @carol !");
  });

  it("supports the same profile mentioned twice", () => {
    const cast = {
      text: " and ",
      mentioned_profiles: [
        { fid: 1, username: "bob" },
        { fid: 1, username: "bob" },
      ],
      mentioned_profiles_ranges: [
        { start: 0, end: 0 },
        { start: 5, end: 5 },
      ],
    };
    expect(castTextWithMentions(cast)).toBe("@bob and @bob");
  });

  it("supports raw protocol fields (mentions + mentions_positions)", () => {
    const cast = { text: "gm ", mentions: [99], mentions_positions: [3] };
    expect(castTextWithMentions(cast)).toBe("gm @fid:99");
  });

  it("leaves Neynar-style text that already contains the mention unchanged", () => {
    const cast = {
      text: "@alice welcome",
      mentioned_profiles: [{ fid: 42, username: "alice" }],
      mentioned_profiles_ranges: [{ start: 0, end: 6 }],
    };
    expect(castTextWithMentions(cast)).toBe("@alice welcome");
  });

  it("does not double-insert when text already has the mention at that spot", () => {
    const cast = {
      text: "@alice hi",
      mentioned_profiles: [{ fid: 42, username: "alice" }],
      mentioned_profiles_ranges: [{ start: 0, end: 0 }],
    };
    expect(castTextWithMentions(cast)).toBe("@alice hi");
  });

  it("ignores out-of-range positions and handles casts without mentions", () => {
    expect(
      castTextWithMentions({
        text: "hi",
        mentioned_profiles: [{ username: "x" }],
        mentioned_profiles_ranges: [{ start: 50, end: 50 }],
      }),
    ).toBe("hi");
    expect(castTextWithMentions({ text: "plain" })).toBe("plain");
    expect(castTextWithMentions(null)).toBe("");
  });

  it("withMentionText returns the same object when nothing changes", () => {
    const cast = { text: "plain" };
    expect(withMentionText(cast)).toBe(cast);
    expect(
      withMentionText({
        text: " hi",
        mentions: [5],
        mentions_positions: [0],
        mentioned_profiles: [{ fid: 5, username: "z" }],
      }).text,
    ).toBe("@z hi");
  });
});
