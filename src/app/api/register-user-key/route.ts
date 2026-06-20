import { NextRequest, NextResponse } from 'next/server';

const WARPCAST_API = 'https://api.warpcast.com';

/**
 * POST /api/register-user-key
 *
 * Accepts a Farcaster SignedKeyRequest where the user signed with their own
 * FID as requestFid (derived from their recovery phrase).  Forwards the
 * request to the Warpcast signed-key-requests API.
 *
 * If Warpcast auto-approves (because the signer is the FID owner), status
 * comes back as "approved".  Otherwise "pending" with a signer_approval_url.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, requestFid, deadline, signature } = body;

    if (!key || !requestFid || !deadline || !signature) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const res = await fetch(`${WARPCAST_API}/v2/signed-key-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ key, requestFid, deadline, signature }),
    });

    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON */ }

    if (!res.ok) {
      const errMsg = data?.errors?.[0]?.message || data?.message || text.slice(0, 300) || `Warpcast error ${res.status}`;
      return NextResponse.json({ ok: false, error: errMsg }, { status: res.status });
    }

    const result = data.result?.signedKeyRequest || data;

    return NextResponse.json({
      ok: true,
      status: result.state === 'completed' ? 'approved' : 'pending',
      signer_approval_url: result.deeplinkUrl ?? null,
      token: result.token ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
