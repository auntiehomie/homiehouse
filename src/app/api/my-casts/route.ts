import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 15;

const HYPERSNAP_BASE =
  process.env.NEXT_PUBLIC_HYPERSNAP_URL || 'https://haatz.quilibrium.com';

// GET /api/my-casts?fid=12345&limit=100
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fid = parseInt(searchParams.get('fid') ?? '', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 200);

  if (!fid || isNaN(fid)) {
    return NextResponse.json({ error: 'fid required' }, { status: 400 });
  }

  try {
    const hubRes = await fetch(
      `${HYPERSNAP_BASE}/v1/castsByFid?fid=${fid}&pageSize=${limit}&reverse=1`,
      { headers: { accept: 'application/json' } },
    );

    if (!hubRes.ok) {
      return NextResponse.json({ error: `Hub error ${hubRes.status}` }, { status: 502 });
    }

    const data = await hubRes.json();
    const messages: any[] = data.messages ?? [];

    const casts = messages
      .filter((m: any) => m.data?.type === 'MESSAGE_TYPE_CAST_ADD')
      .map((m: any) => ({
        hash: m.hash,
        text: m.data?.castAddBody?.text ?? '',
        timestamp: m.data?.timestamp,
        embeds: m.data?.castAddBody?.embeds ?? [],
      }));

    return NextResponse.json({ casts });
  } catch (err: any) {
    console.error('[my-casts] error:', err?.message);
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
