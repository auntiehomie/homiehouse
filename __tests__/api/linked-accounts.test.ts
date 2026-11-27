import { NextRequest } from "next/server";

const mockLinkedAccounts = jest.fn();
jest.mock("@/lib/hypersnap-protocol-auth", () => ({
  createHypersnapProtocolAuthClient: () => ({
    linkedAccounts: mockLinkedAccounts,
  }),
}));
jest.mock("@/lib/farcaster-custody", () => ({ custodyFidOf: jest.fn() }));
jest.mock("@/lib/hypersnap", () => ({ fetchUserByFid: jest.fn() }));
jest.mock("@/lib/ratelimit", () => ({
  rateLimit: jest.fn().mockResolvedValue({ success: true }),
}));

import { GET } from "@/app/api/auth/linked-accounts/route";
import { custodyFidOf } from "@/lib/farcaster-custody";
import { fetchUserByFid } from "@/lib/hypersnap";

const mockCustodyFidOf = custodyFidOf as jest.Mock;
const mockFetchUserByFid = fetchUserByFid as jest.Mock;
const ADDRESS = "0x48939EB1e7Dbe75964B3B208e8668a3F1965ab69";
const request = () =>
  new NextRequest(
    `https://homiehouse.app/api/auth/linked-accounts?address=${ADDRESS}`,
  );
const never = () => new Promise(() => {});

describe("GET /api/auth/linked-accounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockFetchUserByFid.mockResolvedValue({
      user: {
        fid: 3103,
        username: "infinitehomie",
        display_name: "homie",
        pfp_url: "https://x/p.png",
      },
    });
  });

  it("returns the custody FID from the IdRegistry when the hub search hangs", async () => {
    jest.useFakeTimers();
    mockCustodyFidOf.mockResolvedValue(3103);
    mockLinkedAccounts.mockReturnValue(never());

    const pending = GET(request());
    await jest.advanceTimersByTimeAsync(4_000);
    const response = await pending;

    expect(response.status).toBe(200);
    expect((await response.json()).accounts).toEqual([
      {
        fid: 3103,
        username: "infinitehomie",
        displayName: "homie",
        pfpUrl: "https://x/p.png",
        link: { linked: true, method: "custody" },
      },
    ]);
  });

  it("merges hub results and puts the custody FID first without duplicating it", async () => {
    mockCustodyFidOf.mockResolvedValue(3103);
    mockLinkedAccounts.mockResolvedValue([
      {
        fid: 99,
        username: "other",
        link: { linked: true, method: "verified" },
      },
      {
        fid: 3103,
        username: "infinitehomie",
        link: { linked: false, reason: "unlinked" },
      },
    ]);

    const body = await (await GET(request())).json();
    expect(body.accounts.map((a: { fid: number }) => a.fid)).toEqual([
      3103, 99,
    ]);
    expect(body.accounts[0].link).toEqual({ linked: true, method: "custody" });
    expect(mockFetchUserByFid).not.toHaveBeenCalled();
  });

  it("uses hub results for verified-only wallets", async () => {
    mockCustodyFidOf.mockResolvedValue(null);
    mockLinkedAccounts.mockResolvedValue([
      { fid: 99, link: { linked: true, method: "verified" } },
    ]);

    const body = await (await GET(request())).json();
    expect(body.accounts).toEqual([
      { fid: 99, link: { linked: true, method: "verified" } },
    ]);
  });

  it("reports no accounts only when both sources answered", async () => {
    mockCustodyFidOf.mockResolvedValue(null);
    mockLinkedAccounts.mockResolvedValue([]);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).accounts).toEqual([]);
  });

  it("returns 503 when the wallet owns no FID and the hub search fails", async () => {
    mockCustodyFidOf.mockResolvedValue(null);
    mockLinkedAccounts.mockRejectedValue(
      Object.assign(new Error("request failed"), { name: "HubError" }),
    );
    const response = await GET(request());
    expect(response.status).toBe(503);
  });
});
