import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { rateLimit } from "@/lib/ratelimit";
import { createHypersnapProtocolAuthClient } from "@/lib/hypersnap-protocol-auth";

import { HubError } from "@farcasterorg/quick-auth";

export const dynamic = "force-dynamic";
const LOOKUP_DEADLINE_MS = 20_000;
const authClient = createHypersnapProtocolAuthClient();

export async function GET(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const { success } = await rateLimit(
    `hypersnap-linked-accounts:${ip}`,
    20,
    60,
  );
  if (!success)
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const address = new URL(request.url).searchParams.get("address");
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "A valid wallet address is required." },
      { status: 400 },
    );
  }

  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    // Bound the whole lookup so the sign-in modal always gets an answer.
    const accounts = await Promise.race([
      authClient.linkedAccounts(address),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(
          () =>
            reject(new HubError("linked-accounts: lookup deadline exceeded")),
          LOOKUP_DEADLINE_MS,
        );
      }),
    ]);
    return NextResponse.json(
      { accounts },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    const unavailable = error?.name === "HubError";
    console.warn(
      "[linked-accounts] lookup failed:",
      error?.message || String(error),
      error?.cause?.message || "",
    );
    return NextResponse.json(
      {
        error: unavailable
          ? "Hypersnap account lookup is temporarily unavailable."
          : "No linked Hypersnap accounts were found for this wallet.",
      },
      { status: unavailable ? 503 : 404 },
    );
  } finally {
    clearTimeout(deadline);
  }
}
