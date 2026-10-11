import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseEther } from 'viem';
import { base } from 'viem/chains';
import { getDb } from '@/lib/db';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { hypersnapFetch, fallbackFetch } from '@/lib/hypersnap';

export const runtime = 'nodejs';
export const maxDuration = 120;

const RECIPIENT = '0x91275b7C72902f9fDAD3FE4168d5C2CAa81bb432' as const;
const FEE = parseEther('0.0005');
const CAP = 10_000;
const client = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
const styles: Record<string, string> = {
  campus: 'A warm, original digital campus portrait: lively courtyard, brick and glass, community posters without readable words, sunlight, expressive streetwear.',
  afterclass: 'An original after-class campus lounge portrait: cozy common room, books, plants, creative conversation, rich warm lighting, expressive streetwear.',
  homecoming: 'An original campus celebration portrait: joyful evening gathering, tasteful lights, vibrant fashion, welcoming community, energetic but polished.',
};

type Ref = { type: 'image_url'; image_url: { url: string } };

function normalizePortraitName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N} .'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}
function normalizePublicHttpsImage(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 5_500_000) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || host === 'localhost'
      || host.endsWith('.localhost')
      || host.endsWith('.local')
      || host.endsWith('.internal')
      || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
      || host.includes(':')
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isKnownImageHost(value: string): boolean {
  const host = new URL(value).hostname.toLowerCase();
  const imageHosts = ['pbs.twimg.com', 'abs.twimg.com', 'i.imgur.com', 'cdn.farcaster.xyz', 'wrpcd.net'];
  return imageHosts.some((domain) => host === domain || host.endsWith(`.${domain}`))
    || host.endsWith('.imagedelivery.net')
    || host.endsWith('.warpcast.com')
    || host.endsWith('.farcaster.xyz');
}

async function getHypersnapProfileImage(fid: number): Promise<string | null> {
  const endpoint = `/v2/farcaster/user/bulk?fids=${fid}`;
  try {
    const data = await hypersnapFetch(endpoint, { cache: 'no-store' });
    const user = data?.users?.[0] ?? data?.result?.users?.[0];
    const image = user?.pfp_url ?? user?.pfp?.url ?? user?.pfpUrl;
    if (typeof image === 'string') return image;
  } catch {
    // Try the configured secondary Hypersnap node below.
  }
  const fallback = await fallbackFetch(endpoint);
  const user = fallback?.users?.[0] ?? fallback?.result?.users?.[0];
  const image = user?.pfp_url ?? user?.pfp?.url ?? user?.pfpUrl;
  return typeof image === 'string' ? image : null;
}

async function isAllowedImageRef(value: unknown, fid: number): Promise<boolean> {
  if (typeof value !== 'string' || value.length > 5_500_000) return false;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
  const normalized = normalizePublicHttpsImage(value);
  if (!normalized) return false;
  if (isKnownImageHost(normalized)) return true;

  // Hypersnap may return profile photos from additional CDN domains. Permit an
  // unknown host only when the URL exactly matches this authenticated user's
  // current profile photo, fetched server-side by their verified FID.
  const currentProfileImage = normalizePublicHttpsImage(await getHypersnapProfileImage(fid));
  return currentProfileImage !== null && currentProfileImage === normalized;
}

async function ensureTables() {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS pfp_studio_generations (
      id BIGSERIAL PRIMARY KEY,
      fid INTEGER NOT NULL,
      payment_tx_hash TEXT UNIQUE,
      style TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query('CREATE INDEX IF NOT EXISTS pfp_studio_fid_status_idx ON pfp_studio_generations(fid, status)');
  await db.query("CREATE UNIQUE INDEX IF NOT EXISTS pfp_studio_one_free_per_fid ON pfp_studio_generations(fid) WHERE payment_tx_hash IS NULL AND status IN ('pending','complete')");
}

export async function GET(request: NextRequest) {
  try {
    const fid = await verifyFarcasterSignerAuth(request);
    await ensureTables();
    const { rows } = await getDb().query(
      "SELECT COUNT(*) FILTER (WHERE status = 'complete')::int AS user_count, COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count, (SELECT COUNT(*)::int FROM pfp_studio_generations WHERE status IN ('pending','complete')) AS reserved_count FROM pfp_studio_generations WHERE fid = $1",
      [fid],
    );
    return NextResponse.json({
      freeAvailable: Number(rows[0]?.user_count || 0) === 0 && Number(rows[0]?.pending_count || 0) === 0,
      userCount: Number(rows[0]?.user_count || 0),
      remaining: Math.max(0, CAP - Number(rows[0]?.reserved_count || 0)),
      recipient: RECIPIENT,
      feeWei: FEE.toString(),
      chainId: base.id,
    });
  } catch {
    return NextResponse.json({ error: 'Sign in with Farcaster to use PFP Studio.' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  let fid: number;
  try {
    fid = await verifyFarcasterSignerAuth(request);
  } catch {
    return NextResponse.json({ error: 'Sign in with Farcaster to use PFP Studio.' }, { status: 401 });
  }

  let body: { image?: unknown; name?: unknown; style?: unknown; paymentTxHash?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!(await isAllowedImageRef(body.image, fid))) return NextResponse.json({ error: 'Choose a valid HTTPS profile image or upload a PNG, JPEG, or WebP image.' }, { status: 400 });
  const sourceImage = body.image as string;
  const portraitName = normalizePortraitName(body.name);
  if (!portraitName) return NextResponse.json({ error: 'Enter the name to personalize your portrait.' }, { status: 400 });
  if (typeof body.style !== 'string' || !styles[body.style]) return NextResponse.json({ error: 'Choose a listed Homiehouse style.' }, { status: 400 });

  const txHash = typeof body.paymentTxHash === 'string' ? body.paymentTxHash.trim() : '';
  let paid = false;
  if (txHash) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return NextResponse.json({ error: 'Enter a valid Base transaction hash.' }, { status: 400 });
    try {
      const [tx, receipt] = await Promise.all([
        client.getTransaction({ hash: txHash as `0x${string}` }),
        client.getTransactionReceipt({ hash: txHash as `0x${string}` }),
      ]);
      if (receipt.status !== 'success' || !tx.to || tx.to.toLowerCase() !== RECIPIENT.toLowerCase() || tx.value < FEE) {
        return NextResponse.json({ error: 'Payment must be a successful Base transaction of at least 0.0005 ETH to the Homiehouse recipient.' }, { status: 402 });
      }
      paid = true;
    } catch {
      return NextResponse.json({ error: 'Could not verify that transaction on Base. Wait for confirmation and try again.' }, { status: 402 });
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Image generation is not configured yet.' }, { status: 503 });
  const model = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image';

  await ensureTables();
  const db = getDb();
  const reservation = await db.connect();
  let generationId: number | null = null;
  try {
    await reservation.query('BEGIN');
    await reservation.query('SELECT pg_advisory_xact_lock($1)', [91275]);
    const totals = await reservation.query(
      "SELECT COUNT(*) FILTER (WHERE status = 'complete')::int AS complete, COUNT(*) FILTER (WHERE status IN ('pending','complete'))::int AS reserved FROM pfp_studio_generations",
    );
    if (Number(totals.rows[0]?.reserved || 0) >= CAP) {
      await reservation.query('ROLLBACK');
      return NextResponse.json({ error: 'The Homiehouse PFP collection has reached its 10,000 image limit.' }, { status: 409 });
    }
    const own = await reservation.query(
      "SELECT COUNT(*) FILTER (WHERE status = 'complete')::int AS completed, COUNT(*) FILTER (WHERE status = 'pending')::int AS pending FROM pfp_studio_generations WHERE fid = $1 AND status IN ('pending','complete')",
      [fid],
    );
    if (Number(own.rows[0]?.pending || 0) > 0) {
      await reservation.query('ROLLBACK');
      return NextResponse.json({ error: 'A PFP is already being generated for your account.' }, { status: 409 });
    }
    const needsPayment = Number(own.rows[0]?.completed || 0) > 0;
    if (needsPayment && !paid) {
      await reservation.query('ROLLBACK');
      return NextResponse.json({ error: 'Your first PFP is free. Each additional generation costs 0.0005 ETH on Base.', code: 'PAYMENT_REQUIRED' }, { status: 402 });
    }
    if (needsPayment && !txHash) {
      await reservation.query('ROLLBACK');
      return NextResponse.json({ error: 'Provide a new Base payment transaction hash for this generation.', code: 'PAYMENT_REQUIRED' }, { status: 402 });
    }
    const inserted = await reservation.query(
      'INSERT INTO pfp_studio_generations (fid, payment_tx_hash, style) VALUES ($1, $2, $3) RETURNING id',
      [fid, paid && needsPayment ? txHash : null, body.style],
    );
    generationId = Number(inserted.rows[0].id);
    await reservation.query('COMMIT');
  } catch (error: unknown) {
    await reservation.query('ROLLBACK').catch(() => {});
    if (String(error).includes('pfp_studio_generations_payment_tx_hash_key')) {
      return NextResponse.json({ error: 'That payment transaction has already been used.' }, { status: 409 });
    }
    console.error('[pfp-studio] reservation failed', error);
    return NextResponse.json({ error: 'Could not reserve a PFP slot. Please try again.' }, { status: 500 });
  } finally {
    reservation.release();
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `Create a polished, square social profile portrait personalized from both the person's name (${JSON.stringify(portraitName)}) and the attached current profile photo. Use the photo to preserve the person's recognizable face, skin tone, hair, age, and chosen presentation. Let the name gently inform personal style and scene details, but do not render the name as text. Restyle them into Homiehouse's original digital-campus visual world: ${styles[body.style]}. Warm, community-centered, fashionable, expressive, premium editorial illustration. Do not depict or imitate any existing television show, actor, logo, branded costume, or copyrighted set. No text, no watermark. Centered shoulders-up composition with clear face, suitable as a small circular avatar.`,
        aspect_ratio: '1:1',
        resolution: '1K',
        output_format: 'png',
        input_references: [{ type: 'image_url', image_url: { url: sourceImage } } satisfies Ref],
        user: `fid:${fid}`,
      }),
      signal: AbortSignal.timeout(110_000),
    });
    const result = await response.json();
    const image = result?.data?.[0]?.b64_json;
    const mediaType = result?.data?.[0]?.media_type;
    if (!response.ok || typeof image !== 'string' || !/^image\/(png|jpeg|webp)$/.test(mediaType || '')) {
      throw new Error('Image provider did not return a supported image');
    }
    await db.query("UPDATE pfp_studio_generations SET status = 'complete' WHERE id = $1", [generationId]);
    return NextResponse.json({ image: `data:${mediaType};base64,${image}`, style: body.style });
  } catch (error) {
    await db.query("UPDATE pfp_studio_generations SET status = 'failed', payment_tx_hash = NULL WHERE id = $1", [generationId]);
    console.error('[pfp-studio] generation failed', error);
    return NextResponse.json({ error: 'Image generation failed. Please try again.' }, { status: 502 });
  }
}
