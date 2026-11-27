import { createMessage, encodeToken } from "@farcasterorg/quick-auth/token";
import { privateKeyToAccount } from "viem/accounts";
import {
  createHypersnapProtocolAuthClient,
  getHomieHouseAuthDomain,
} from "@/lib/hypersnap-protocol-auth";

describe("Hypersnap protocol auth", () => {
  const account = privateKeyToAccount(`0x${"11".repeat(32)}`);

  afterEach(() => {
    delete process.env.HOMIEHOUSE_AUTH_DOMAIN;
    delete process.env.NEXT_PUBLIC_BASE_URL;
    delete process.env.NEXT_PUBLIC_HYPERSNAP_URL;
  });

  async function makeToken(domain = "homiehouse.app") {
    const message = createMessage({
      domain,
      address: account.address,
      chainId: 1,
      fid: 42,
      nonce: "testnonce123",
    });
    const signature = await account.signMessage({ message });
    return encodeToken({ message, signature });
  }

  it("uses the configured canonical app host for token audience checks", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://homiehouse.app/path";
    expect(getHomieHouseAuthDomain()).toBe("homiehouse.app");

    process.env.HOMIEHOUSE_AUTH_DOMAIN = "preview-homiehouse.vercel.app";
    expect(getHomieHouseAuthDomain()).toBe("preview-homiehouse.vercel.app");
  });

  it("verifies a signed token against the configured Hypersnap Hub API", async () => {
    const fetcher = jest.fn(async (input: RequestInfo | URL) => {
      expect(new URL(String(input)).origin).toBe("https://snap.example");
      expect(new URL(String(input)).pathname).toBe("/v1/fidAddressType");
      return new Response(
        JSON.stringify({ is_custody: true, is_verified: false }),
        { status: 200 },
      );
    });
    const client = createHypersnapProtocolAuthClient({
      hubUrl: "https://snap.example",
      fetch: fetcher as typeof fetch,
    });

    const payload = await client.verifyToken({
      token: await makeToken(),
      domain: "homiehouse.app",
    });
    expect(payload).toMatchObject({
      sub: 42,
      address: account.address,
      method: "custody",
      aud: "homiehouse.app",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails over to the next node when the first one is unreachable during a wallet lookup", async () => {
    const env = process.env;
    process.env = {
      ...env,
      MY_HYPERSNAP_NODE_URL: "https://rpc.example.test",
      NEXT_PUBLIC_HYPERSNAP_URL: "https://haatz.quilibrium.com",
    };
    const realFetch = global.fetch;
    const calls: string[] = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url.origin + url.pathname);
      if (url.origin === "https://rpc.example.test")
        throw new Error("connect ETIMEDOUT");
      if (url.pathname === "/v2/farcaster/user/bulk-by-address") {
        return new Response(
          JSON.stringify({ users: [{ fid: 42, username: "amanda" }] }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ is_custody: true, is_verified: false }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const accounts = await createHypersnapProtocolAuthClient().linkedAccounts(
        account.address,
      );
      expect(accounts).toEqual([
        expect.objectContaining({
          fid: 42,
          username: "amanda",
          link: { linked: true, method: "custody" },
        }),
      ]);
      expect(calls).toEqual([
        "https://rpc.example.test/v2/farcaster/user/bulk-by-address",
        "https://haatz.quilibrium.com/v2/farcaster/user/bulk-by-address",
        "https://rpc.example.test/v1/fidAddressType",
        "https://haatz.quilibrium.com/v1/fidAddressType",
      ]);
    } finally {
      global.fetch = realFetch;
      process.env = env;
    }
  });

  it("rejects the same signed token for a different domain before querying the Hub", async () => {
    const fetcher = jest.fn();
    const client = createHypersnapProtocolAuthClient({
      hubUrl: "https://snap.example",
      fetch: fetcher as typeof fetch,
    });

    await expect(
      client.verifyToken({
        token: await makeToken(),
        domain: "attacker.example",
      }),
    ).rejects.toThrow("token is for homiehouse.app, not attacker.example");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not accept classic Quick Auth JWTs in this Hypersnap-only path", async () => {
    const client = createHypersnapProtocolAuthClient({
      hubUrl: "https://snap.example",
      fetch: jest.fn() as typeof fetch,
    });

    await expect(
      client.verifyToken({
        token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.signature",
        domain: "homiehouse.app",
      }),
    ).rejects.toThrow("not a protocol Quick Auth token");
  });
});
