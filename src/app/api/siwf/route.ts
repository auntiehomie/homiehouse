import { NextRequest, NextResponse } from "next/server";
import { createAppClient, viemConnector } from "@farcaster/auth-client";

// This route accepts either a quickAuth token (dev fallback) or a SIWF payload
// { message, signature, nonce } and verifies it using @farcaster/auth-client.

const RPC_URL = process.env.FARC_RPC_URL || process.env.RPC_URL || "https://mainnet.optimism.io";

const appClient = createAppClient({
  ethereum: viemConnector(RPC_URL as any),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Log incoming body for debugging (development)
    try {
      console.log("/api/siwf incoming body:", JSON.stringify(body));
    } catch {}

    // Development quickAuth token path (keeps local dev working)
    const token = body?.token;
    if (token && typeof token === "string" && token.includes("mock")) {
      return NextResponse.json({
        ok: true,
        profile: {
          username: "dev_user",
          displayName: "Developer",
          avatar: "https://www.gravatar.com/avatar/?d=mp&s=80",
        },
      });
    }

    // SIWF verification path (AuthKit/auth-client)
    const { message, signature, nonce } = body || {};
    // Determine domain for verification. AuthKit messages usually use hostname
    // (e.g. 'localhost') while the incoming Host header may include a port
    // (e.g. 'localhost:3000'). Normalize to the hostname to avoid mismatches.
    const rawDomain = body?.domain || req.headers.get("host") || "";
    const domain = String(rawDomain).split(":")[0];

    if (!message || !signature) {
      return NextResponse.json({ ok: false, error: "missing message or signature" }, { status: 400 });
    }

    // Verify the SIWF message/signature using auth-client helper
    const verifyRes = await appClient.verifySignInMessage({
      nonce: nonce ?? undefined,
      domain,
      message,
      signature,
    });

    // Log verification response for debugging
    try {
      console.log("/api/siwf verifyRes:", JSON.stringify(verifyRes));
    } catch {}

    if (!verifyRes || !verifyRes.success) {
      return NextResponse.json({ ok: false, error: "signature verification failed", verifyRes }, { status: 401 });
    }

    // success: return normalized profile information
    const parsed = verifyRes.data as any;
    const profile: any = {
      fid: verifyRes.fid ?? parsed?.fid,
      username: parsed?.username,
      displayName: parsed?.displayName ?? parsed?.display_name,
      avatar: parsed?.pfpUrl ?? parsed?.pfp_url,
    };

    return NextResponse.json({ ok: true, profile });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
