import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const maxDuration = 10;

// GET /api/learning-progress?fid=12345
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fid = parseInt(searchParams.get('fid') ?? '', 10);

  if (!fid || isNaN(fid)) {
    return NextResponse.json({ error: 'fid required' }, { status: 400 });
  }

  try {
    const rows = await sql`
      SELECT plan, completed_ids, completions, updated_at
      FROM learning_progress
      WHERE fid = ${fid}
    `;

    if (rows.length === 0) return NextResponse.json({ found: false });

    const row = rows[0];
    return NextResponse.json({
      found: true,
      plan: row.plan,
      completed_ids: row.completed_ids ?? [],
      completions: row.completions ?? {},
      updated_at: row.updated_at,
    });
  } catch (err: any) {
    console.error('[learning-progress] GET error:', err?.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/learning-progress
// Body: { fid, plan, completed_ids, completions }
export async function POST(req: NextRequest) {
  try {
    const { fid, plan, completed_ids, completions } = await req.json();

    if (!fid) {
      return NextResponse.json({ error: 'fid required' }, { status: 400 });
    }

    await sql`
      INSERT INTO learning_progress (fid, plan, completed_ids, completions, updated_at)
      VALUES (
        ${fid},
        ${JSON.stringify(plan ?? null)}::jsonb,
        ${JSON.stringify(completed_ids ?? [])}::jsonb,
        ${JSON.stringify(completions ?? {})}::jsonb,
        NOW()
      )
      ON CONFLICT (fid) DO UPDATE SET
        plan = EXCLUDED.plan,
        completed_ids = EXCLUDED.completed_ids,
        completions = EXCLUDED.completions,
        updated_at = NOW()
    `;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[learning-progress] POST error:', err?.message);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
