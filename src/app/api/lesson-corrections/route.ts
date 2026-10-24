import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createApiLogger } from '@/lib/logger';
import { checkRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';
import { AuthError } from '@/lib/errors';
import { parseLessonCorrectionReportInput } from '@/lib/lesson-correction-report';

const logger = createApiLogger('/lesson-corrections');

const CREATE_REPORTS_TABLE = `
  CREATE TABLE IF NOT EXISTS lesson_correction_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id TEXT NOT NULL,
    module_title TEXT NOT NULL,
    step_number INTEGER NOT NULL CHECK (step_number > 0),
    card_label TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('factually_incorrect', 'outdated', 'missing_source', 'unclear', 'other')),
    report TEXT NOT NULL,
    suggested_correction TEXT,
    source_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    resolution_note TEXT
  )
`;

async function ensureTable() {
  const db = getDb();
  await db.query(CREATE_REPORTS_TABLE);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_lesson_correction_reports_status_created
    ON lesson_correction_reports (status, created_at DESC)
  `);
  return db;
}

function adminAuthorized(request: NextRequest): boolean {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get('authorization') ?? '';
  return authorization === `Bearer ${secret}`;
}

/** Anonymous submissions are accepted; only the module and step metadata are attached automatically. */
export async function POST(request: NextRequest) {
  try {
    const key = `lesson-corrections:${rateLimitKeyFromRequest(request)}`;
    const limit = await checkRateLimit(key, 5, 3600);
    if (!limit.success) {
      return NextResponse.json({ error: 'Too many reports. Try again later.' }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'A JSON report is required.' }, { status: 400 });
    }

    const parsed = parseLessonCorrectionReportInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const db = await ensureTable();
    const { rows } = await db.query(
      `INSERT INTO lesson_correction_reports
        (module_id, module_title, step_number, card_label, category, report, suggested_correction, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        parsed.value.moduleId,
        parsed.value.moduleTitle,
        parsed.value.stepNumber,
        parsed.value.cardLabel,
        parsed.value.category,
        parsed.value.report,
        parsed.value.suggestedCorrection,
        parsed.value.sourceUrl,
      ],
    );

    return NextResponse.json({ ok: true, reportId: rows[0]?.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Could not store lesson correction report', error);
    return NextResponse.json({ error: 'Could not submit the report. Please try again.' }, { status: 503 });
  }
}

/** Private review queue for maintainers. Requires the existing server-side MIGRATE_SECRET. */
export async function GET(request: NextRequest) {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get('status') ?? 'pending';
  if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid report status.' }, { status: 400 });
  }

  try {
    const db = await ensureTable();
    const { rows } = await db.query(
      `SELECT id, module_id, module_title, step_number, card_label, category, report,
              suggested_correction, source_url, status, created_at, reviewed_at, resolution_note
       FROM lesson_correction_reports
       WHERE status = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [status],
    );
    return NextResponse.json({ reports: rows }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    logger.error('Could not read lesson correction review queue', error);
    return NextResponse.json({ error: 'Could not load the review queue.' }, { status: 503 });
  }
}

/** Mark a report after review without changing the lesson automatically. */
export async function PATCH(request: NextRequest) {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'A JSON update is required.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const status = body.status;
  const note = typeof body.resolutionNote === 'string' ? body.resolutionNote.trim() : null;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['reviewed', 'resolved', 'dismissed'].includes(String(status))) {
    return NextResponse.json({ error: 'A valid report ID and review status are required.' }, { status: 400 });
  }
  if (note && note.length > 1000) {
    return NextResponse.json({ error: 'The resolution note is too long.' }, { status: 400 });
  }

  try {
    const db = await ensureTable();
    const { rows } = await db.query(
      `UPDATE lesson_correction_reports
       SET status = $2, reviewed_at = NOW(), resolution_note = $3
       WHERE id = $1
       RETURNING id, status, reviewed_at, resolution_note`,
      [id, status, note],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, report: rows[0] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    logger.error('Could not update lesson correction report', error);
    return NextResponse.json({ error: 'Could not update the report.' }, { status: 503 });
  }
}
