import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "@/app/api/saved-casts/route";
import { sql } from "@/lib/db";
import { verifyFarcasterSignerAuth } from "@/lib/auth";
import { AuthError } from "@/lib/errors";

jest.mock("@/lib/db", () => ({ sql: jest.fn() }));
jest.mock("@/lib/ratelimit", () => ({
  rateLimit: jest.fn(() => ({ success: true })),
}));
// Mocked so the route's identity always comes from the signer, never the request
// body — and so the ESM-only @noble/ed25519 dependency stays out of the test run.
jest.mock("@/lib/auth", () => ({ verifyFarcasterSignerAuth: jest.fn() }));

const mockSql = sql as jest.Mock;
const mockAuth = verifyFarcasterSignerAuth as jest.Mock;
const request = (url: string, init?: RequestInit) =>
  new NextRequest(`http://localhost${url}`, init);

const AUTHED_FID = 123;

describe("/api/saved-casts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(AUTHED_FID);
  });

  it("lists saved casts for the authenticated user", async () => {
    mockSql.mockResolvedValueOnce([{ id: 1, cast_hash: "0xabc" }]);
    const response = await GET(request("/api/saved-casts"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      casts: [{ id: 1, cast_hash: "0xabc" }],
    });
  });

  it("saves a cast and returns its id", async () => {
    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 7 }])
      .mockResolvedValueOnce([{ id: 42 }]);
    const response = await POST(
      request("/api/saved-casts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cast_hash: "0xabc", embeds: [] }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ saved: true, id: 42 });
  });

  it("deletes a saved cast", async () => {
    mockSql.mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([]);
    const response = await DELETE(
      request("/api/saved-casts", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cast_hash: "0xabc" }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
  });

  it.each([
    [
      "POST",
      () =>
        POST(
          request("/api/saved-casts", {
            method: "POST",
            body: JSON.stringify({}),
          }),
        ),
    ],
    [
      "DELETE",
      () =>
        DELETE(
          request("/api/saved-casts", {
            method: "DELETE",
            body: JSON.stringify({}),
          }),
        ),
    ],
  ])("rejects invalid %s input", async (_method, invoke) => {
    const response = await invoke();
    expect(response.status).toBe(400);
  });

  it.each([
    ["GET", () => GET(request("/api/saved-casts"))],
    [
      "POST",
      () =>
        POST(
          request("/api/saved-casts", {
            method: "POST",
            body: JSON.stringify({ cast_hash: "0xabc" }),
          }),
        ),
    ],
    [
      "DELETE",
      () =>
        DELETE(
          request("/api/saved-casts", {
            method: "DELETE",
            body: JSON.stringify({ cast_hash: "0xabc" }),
          }),
        ),
    ],
  ])("rejects unauthenticated %s", async (_method, invoke) => {
    mockAuth.mockRejectedValue(
      new AuthError("Missing signer auth", 401, "UNAUTHORIZED"),
    );
    const response = await invoke();
    expect(response.status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });

  // Regression: a caller used to be able to read or mutate another user's saved
  // casts by putting that user's fid in the query string or body.
  it("ignores a client-supplied fid and uses the authenticated one", async () => {
    mockSql.mockResolvedValueOnce([]);
    await GET(request("/api/saved-casts?fid=999"));
    const boundValues = mockSql.mock.calls[0].slice(1);
    expect(boundValues).toContain(AUTHED_FID);
    expect(boundValues).not.toContain(999);
  });

  it("propagates a database failure as a 500", async () => {
    mockSql.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await GET(request("/api/saved-casts"));
    expect(response.status).toBe(500);
  });
});
