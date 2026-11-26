import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  buildSignedMessage,
  hexToBytes,
  MessageType,
} from "@/lib/fc-message-builder";
import type { CastEmbed } from "@/lib/fc-message-builder";
import { ed25519 } from "@noble/curves/ed25519";
import { decryptSignerKey } from "@/lib/signer-crypto";
import { fetchChannelParentUrl } from "@/lib/hypersnap";
import { castTypeForText } from "@/lib/cast-text";

// Use the same write targets as /api/submit-cast (personal node first, Haatz
// as fallback) so scheduled casts land wherever immediate casts land.
const DEFAULT_HYPERSNAP_URL = "https://haatz.quilibrium.com";
const HYPERSNAP_WRITE_TARGETS = [
  ...new Set(
    [
      process.env.MY_HYPERSNAP_NODE_URL?.trim() ||
        process.env.HYPERSNAP_NODE_URL?.trim() ||
        process.env.SNAPCHAIN_NODE_URL?.trim() ||
        process.env.NEXT_PUBLIC_HYPERSNAP_URL ||
        DEFAULT_HYPERSNAP_URL,
      process.env.HYPERSNAP_FALLBACK_URL?.trim() ||
        process.env.SNAPCHAIN_FALLBACK_URL?.trim() ||
        DEFAULT_HYPERSNAP_URL,
    ]
      .map((url) => url.replace(/\/+$/, ""))
      .filter(Boolean),
  ),
];

async function submitToHypersnap(message: Uint8Array): Promise<any> {
  let lastError = "No Hypersnap write target is configured";
  for (const [index, baseUrl] of HYPERSNAP_WRITE_TARGETS.entries()) {
    try {
      const res = await fetch(`${baseUrl}/v1/submitMessage`, {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          accept: "application/json",
        },
        body: message as unknown as BodyInit,
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      const detail =
        data.details ||
        data.error_detail ||
        data.errMsg ||
        data.message ||
        data.error ||
        `Hub error ${res.status}`;
      lastError = typeof detail === "string" ? detail : JSON.stringify(detail);
      // 4xx means the hub rejected the message itself; another node won't help.
      if (res.status < 500 || index === HYPERSNAP_WRITE_TARGETS.length - 1)
        break;
      console.warn(
        `[publish-scheduled] ${baseUrl} returned ${res.status}; trying fallback`,
      );
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.warn(`[publish-scheduled] ${baseUrl} unreachable:`, lastError);
    }
  }
  throw new Error(lastError);
}

async function publishWithStoredKey(cast: any): Promise<string> {
  // Decrypt the stored signer key (encrypted at schedule time from the auth header)
  const privateKeyHex = decryptSignerKey(cast.signer_uuid);
  if (!privateKeyHex) {
    throw new Error(
      "No valid signer key stored. Re-schedule this cast after approving posting permissions.",
    );
  }

  const privateKeyBytes = hexToBytes(privateKeyHex);
  const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes);
  const signer = {
    publicKey: publicKeyBytes,
    sign: async (hash: Uint8Array) => ed25519.sign(hash, privateKeyBytes),
  };

  const rawEmbeds: Array<{ url: string }> = Array.isArray(cast.embeds)
    ? cast.embeds
    : JSON.parse(cast.embeds || "[]");
  const castEmbeds: CastEmbed[] = rawEmbeds.map((e: { url: string }) => ({
    url: e.url,
  }));
  const parentUrl = cast.channel_id
    ? await fetchChannelParentUrl(cast.channel_id)
    : undefined;

  const message = await buildSignedMessage(
    {
      type: MessageType.CAST_ADD,
      fid: cast.user_fid,
      body: {
        castAddBody: {
          text: cast.text,
          // Casts over 320 bytes must be marked LONG_CAST or the hub rejects them.
          type: castTypeForText(cast.text),
          embeds: castEmbeds.length ? castEmbeds : undefined,
          parent: parentUrl ? { url: parentUrl } : undefined,
        },
      },
    },
    signer,
  );

  const result = await submitToHypersnap(message);
  return result.hash ?? result.cast?.hash ?? result.data?.hash ?? "";
}

function scheduledCastAuthorization(
  req: NextRequest,
): NextResponse | undefined {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.length < 32) {
    return NextResponse.json(
      { ok: false, error: "Service unavailable" },
      { status: 503 },
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}

async function handlePublishScheduledCasts(req: NextRequest) {
  try {
    const denied = scheduledCastAuthorization(req);
    if (denied) return denied;

    console.log("✅ Cron job running");

    const now = new Date();
    const nowIso = now.toISOString();
    console.log("⏰ Current time:", nowIso);

    // Atomically claim rows by flipping status to 'processing' before publishing.
    // This prevents duplicate publishes if two cron invocations overlap.
    const scheduledCasts = await sql`
      UPDATE scheduled_casts
      SET status = 'processing'
      WHERE status = 'pending' AND scheduled_time <= ${nowIso}::timestamptz
      RETURNING *
    `;

    console.log(`📋 Claimed ${scheduledCasts.length} casts to publish`);

    const results = [];

    for (const cast of scheduledCasts) {
      try {
        console.log(
          `📤 Publishing cast ${cast.id} for user ${cast.user_fid}...`,
        );

        const castHash = await publishWithStoredKey(cast);

        console.log(`✅ Published! Hash: ${castHash}`);

        await sql`
          UPDATE scheduled_casts
          SET status = 'published', published_at = ${nowIso}::timestamptz, cast_hash = ${castHash || null}
          WHERE id = ${cast.id}
        `;

        results.push({ id: cast.id, success: true, cast_hash: castHash });
      } catch (error: any) {
        console.error(`❌ Error publishing cast ${cast.id}:`, error.message);

        await sql`
          UPDATE scheduled_casts
          SET status = 'failed', error_message = ${error.message}
          WHERE id = ${cast.id}
        `;

        results.push({ id: cast.id, success: false, error: error.message });
      }
    }

    console.log(`✅ Cron complete. Processed ${results.length} casts.`);
    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (error: any) {
    console.error("Error in publish-scheduled-casts:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handlePublishScheduledCasts(req);
}

export async function POST(req: NextRequest) {
  return handlePublishScheduledCasts(req);
}

export async function PUT(req: NextRequest) {
  try {
    const denied = scheduledCastAuthorization(req);
    if (denied) return denied;

    const body = await req.json();
    const { id, fid } = body;

    if (!id || !fid) {
      return NextResponse.json(
        { ok: false, error: "Missing id or fid" },
        { status: 400 },
      );
    }

    const userFid = Number(fid);
    if (!userFid || isNaN(userFid)) {
      return NextResponse.json(
        { ok: false, error: "Invalid fid" },
        { status: 400 },
      );
    }

    const rows = await sql`
      SELECT * FROM scheduled_casts
      WHERE id = ${id} AND user_fid = ${userFid} AND status = 'pending'
    `;

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "Scheduled cast not found or not pending" },
        { status: 404 },
      );
    }

    const cast = rows[0];
    try {
      const castHash = await publishWithStoredKey(cast);

      await sql`
        UPDATE scheduled_casts
        SET status = 'published', published_at = NOW(), cast_hash = ${castHash || null}
        WHERE id = ${id}
      `;

      return NextResponse.json({
        ok: true,
        cast_hash: castHash,
        message: "Cast published successfully",
      });
    } catch (error: any) {
      await sql`
        UPDATE scheduled_casts
        SET status = 'failed', error_message = ${error.message}
        WHERE id = ${id}
      `;
      return NextResponse.json(
        { ok: false, error: `Failed to publish cast: ${error.message}` },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("Error in publish-scheduled-casts PUT:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Unknown error" },
      { status: 500 },
    );
  }
}
