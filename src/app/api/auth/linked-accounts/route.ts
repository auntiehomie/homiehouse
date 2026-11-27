import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { rateLimit } from "@/lib/ratelimit";
import { createHypersnapProtocolAuthClient } from "@/lib/hypersnap-protocol-auth";
import { custodyFidOf } from "@/lib/farcaster-custody";
import { fetchUserByFid } from "@/lib/hypersnap";

export const dynamic = "force-dynamic";

/** Hub search budget when the chain already told us the custody FID. */
const HUB_BUDGET_WITH_CUSTODY_MS = 4_000;
/** Hub search budget when it is the only way to find an account (verified-only wallets). */
const HUB_BUDGET_MS = 18_000;
const PROFILE_BUDGET_MS = 4_000;

const authClient = createHypersnapProtocolAuthClient();

type HubAccount = Awaited<ReturnType<typeof authClient.linkedAccounts>>[number];
interface LinkedAccount {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  link: HubAccount["link"];
}

type Settled<T> =
  | { status: "ok"; value: T }
  | { status: "error"; error: unknown }
  | { status: "timeout" };

/** Wait for `promise` up to `ms` without rejecting. */
function settleWithin<T>(promise: Promise<T>, ms: number): Promise<Settled<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.then(
      (value) => ({ status: "ok", value }) as const,
      (error) => ({ status: "error", error }) as const,
    ),
    new Promise<Settled<T>>((resolve) => {
      timer = setTimeout(() => resolve({ status: "timeout" }), Math.max(0, ms));
    }),
  ]).finally(() => clearTimeout(timer));
}

async function custodyAccount(fid: number): Promise<LinkedAccount> {
  const profile = await settleWithin(fetchUserByFid(fid), PROFILE_BUDGET_MS);
  const user = profile.status === "ok" ? profile.value?.user : null;
  return {
    fid,
    username: user?.username || undefined,
    displayName: user?.display_name || undefined,
    pfpUrl: user?.pfp_url || undefined,
    link: { linked: true, method: "custody" },
  };
}

/**
 * GET /api/auth/linked-accounts?address=0x…
 *
 * Finds FIDs a wallet can sign in as. Two sources run in parallel:
 *  - the IdRegistry on Optimism (`idOf`) for the wallet's custody FID — one
 *    contract read, authoritative;
 *  - the Hypersnap hub search for FIDs that verified this address. Fast for
 *    verified addresses, but a custody-only wallet makes the hub scan every
 *    IdRegister event, which times out on haatz. So once the chain has
 *    answered, the hub only gets a short window.
 * The sign-in itself is still verified against the hub (`fidAddressType`),
 * which is keyed by FID and fast.
 */
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

  const startedAt = Date.now();
  const hubLookup = authClient.linkedAccounts(address);
  hubLookup.catch(() => {}); // settled below; never an unhandled rejection

  const custody = await settleWithin(custodyFidOf(address), 10_000);
  const custodyFid = custody.status === "ok" ? custody.value : null;
  if (custody.status !== "ok") {
    console.warn(
      "[linked-accounts] IdRegistry lookup failed:",
      custody.status === "error"
        ? (custody.error as Error)?.message
        : "timeout",
    );
  }

  const hubBudget = custodyFid
    ? HUB_BUDGET_WITH_CUSTODY_MS
    : HUB_BUDGET_MS - (Date.now() - startedAt);
  const hub = await settleWithin(hubLookup, hubBudget);
  if (hub.status !== "ok") {
    const reason =
      hub.status === "error" ? (hub.error as Error & { cause?: Error }) : null;
    console.warn(
      "[linked-accounts] hub search",
      hub.status === "timeout" ? `timed out after ${hubBudget}ms` : "failed:",
      reason?.message || "",
      reason?.cause?.message || "",
    );
  }

  let accounts: LinkedAccount[] = hub.status === "ok" ? hub.value : [];
  if (custodyFid) {
    // The custody FID goes first; reuse the hub's profile if it found it too.
    const fromHub = accounts.find((account) => account.fid === custodyFid);
    const custodyEntry: LinkedAccount = fromHub
      ? { ...fromHub, link: { linked: true, method: "custody" } }
      : await custodyAccount(custodyFid);
    accounts = [
      custodyEntry,
      ...accounts.filter((account) => account.fid !== custodyFid),
    ];
  }

  // An empty list is only a real "no account" when both sources answered.
  if (
    accounts.length === 0 &&
    (hub.status !== "ok" || custody.status !== "ok")
  ) {
    return NextResponse.json(
      { error: "Hypersnap account lookup is temporarily unavailable." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { accounts },
    { headers: { "Cache-Control": "no-store" } },
  );
}
