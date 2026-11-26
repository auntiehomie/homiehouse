import { NextRequest } from "next/server";
import { GET } from "@/app/api/publish-scheduled-casts/route";
import { buildSignedMessage, CastType } from "@/lib/fc-message-builder";
import { sql } from "@/lib/db";

jest.mock("@noble/curves/ed25519", () => ({
  ed25519: {
    getPublicKey: jest.fn(() => new Uint8Array(32)),
    sign: jest.fn(() => new Uint8Array(64)),
  },
}));
jest.mock("@/lib/signer-crypto", () => ({
  decryptSignerKey: jest.fn(() => "11".repeat(32)),
}));
jest.mock("@/lib/hypersnap", () => ({ fetchChannelParentUrl: jest.fn() }));
jest.mock("@/lib/db", () => ({ sql: jest.fn() }));
jest.mock("@/lib/fc-message-builder", () => {
  const actual = jest.requireActual("@/lib/fc-message-builder");
  return {
    ...actual,
    buildSignedMessage: jest.fn(async () => new Uint8Array([1, 2, 3])),
  };
});

const secret = "test-cron-secret".repeat(3);
const originalEnv = process.env;
const originalFetch = global.fetch;

function cronRequest() {
  return new NextRequest("https://homiehouse.lol/api/publish-scheduled-casts", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, CRON_SECRET: secret };
});

afterEach(() => {
  process.env = originalEnv;
  global.fetch = originalFetch;
});

describe("publish-scheduled-casts cron", () => {
  it("marks casts over 320 bytes as LONG_CAST so the hub accepts them", async () => {
    const longText = `One thing I learned in “Blockchain Basics”: ${"x".repeat(300)} #HomieHouseLearning`;
    (sql as unknown as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "c1",
          user_fid: 42,
          text: longText,
          embeds: [],
          channel_id: null,
          signer_uuid: "enc:x",
        },
      ])
      .mockResolvedValue([]);
    global.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ hash: "0xabc" }), { status: 200 }),
    ) as any;

    const res = await GET(cronRequest());
    const body = await res.json();

    expect(body.results).toEqual([
      { id: "c1", success: true, cast_hash: "0xabc" },
    ]);
    const input = (buildSignedMessage as jest.Mock).mock.calls[0][0];
    expect(input.body.castAddBody.type).toBe(CastType.LONG_CAST);
  });

  it("records the hub rejection detail when publishing fails", async () => {
    (sql as unknown as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "c2",
          user_fid: 42,
          text: "short",
          embeds: [],
          channel_id: null,
          signer_uuid: "enc:x",
        },
      ])
      .mockResolvedValue([]);
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            errCode: "bad_request",
            message: "Failed to submit message",
            details: "invalid signer",
          }),
          { status: 400 },
        ),
    ) as any;

    const body = await (await GET(cronRequest())).json();

    expect(body.results).toEqual([
      { id: "c2", success: false, error: "invalid signer" },
    ]);
    expect(
      (buildSignedMessage as jest.Mock).mock.calls[0][0].body.castAddBody.type,
    ).toBe(CastType.CAST);
  });
});
