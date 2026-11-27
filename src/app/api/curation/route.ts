import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { handleApiError, AuthError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid } from '@/lib/validation';
import { verifyFarcasterSignerAuth } from '@/lib/auth';

/**
 * Feed curation preferences, stored in the app database.
 *
 * Previously proxied to a separate curation server (SERVER_URL, default
 * localhost:3001) whose code is no longer in this repo. Every query is scoped
 * to the session FID, so a user can only read or change their own rows.
 */

const PREFERENCE_TYPES = new Set(['keyword', 'channel', 'author', 'content_type', 'min_likes', 'max_length']);
const NUMERIC_TYPES = new Set(['min_likes', 'max_length']);
const ACTIONS = new Set(['include', 'exclude']);
const MAX_PREFERENCES_PER_USER = 200;

interface CurationPreference {
  id: number;
  fid: number;
  preference_type: string;
  preference_value: string;
  action: 'include' | 'exclude';
  priority: number;
  created_at: string;
  updated_at: string;
}

let tableReady: Promise<void> | null = null;

/** Create the table on first use; idempotent and safe to run concurrently. */
function ensureCurationTable(): Promise<void> {
  tableReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS user_curation_preferences (
        id               BIGSERIAL PRIMARY KEY,
        fid              BIGINT NOT NULL,
        preference_type  TEXT NOT NULL,
        preference_value TEXT NOT NULL,
        action           TEXT NOT NULL CHECK (action IN ('include', 'exclude')),
        priority         INTEGER NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_curation_unique
        ON user_curation_preferences (fid, preference_type, preference_value)
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_curation_fid ON user_curation_preferences (fid)`;
  })().catch((error) => {
    tableReady = null; // retry on the next request
    throw error;
  });
  return tableReady;
}

function authError(error: unknown) {
  return error instanceof AuthError
    ? NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    : null;
}

function badRequest(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function normalizeRow(row: Record<string, unknown>): CurationPreference {
  return { ...row, id: Number(row.id), fid: Number(row.fid), priority: Number(row.priority) } as CurationPreference;
}

/** Validate a value for its type; returns the cleaned value or null. */
function cleanValue(type: string, value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return null;
  if (NUMERIC_TYPES.has(type)) {
    if (!/^\d{1,7}$/.test(trimmed)) return null;
    return String(Number(trimmed));
  }
  return trimmed;
}

function validPriority(priority: unknown): priority is number {
  return Number.isInteger(priority) && Math.abs(priority as number) <= 100;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === '23505';
}

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/curation');
  try {
    const fid = await verifyFarcasterSignerAuth(request, 'read:all');
    const fidParam = request.nextUrl.searchParams.get('fid');
    if (fidParam && validateFid(fidParam) !== fid) {
      return badRequest('You can only read your own preferences', 403);
    }
    const type = request.nextUrl.searchParams.get('type');
    if (type && !PREFERENCE_TYPES.has(type)) return badRequest('Invalid preference type');

    await ensureCurationTable();
    const rows = type
      ? await sql`
          SELECT * FROM user_curation_preferences
          WHERE fid = ${fid} AND preference_type = ${type}
          ORDER BY priority DESC, created_at ASC`
      : await sql`
          SELECT * FROM user_curation_preferences
          WHERE fid = ${fid}
          ORDER BY priority DESC, created_at ASC`;
    return NextResponse.json(
      { ok: true, preferences: rows.map(normalizeRow) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    logger.error('Failed to fetch curation preferences', error);
    return handleApiError(error, 'GET /curation');
  }
}

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/curation POST');
  try {
    const fid = await verifyFarcasterSignerAuth(request, 'write:lists');
    const body = await request.json().catch(() => null);
    if (!body || (body.fid !== undefined && String(body.fid) !== String(fid))) {
      return badRequest('Authenticated FID does not match request', 403);
    }
    const { preference_type, action } = body;
    const priority = body.priority ?? 0;
    const value = PREFERENCE_TYPES.has(preference_type) ? cleanValue(preference_type, body.preference_value) : null;
    if (!value || !ACTIONS.has(action) || !validPriority(priority)) {
      return badRequest('Invalid curation preference');
    }

    await ensureCurationTable();
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM user_curation_preferences WHERE fid = ${fid}`;
    if (Number(count) >= MAX_PREFERENCES_PER_USER) {
      return badRequest(`You can save up to ${MAX_PREFERENCES_PER_USER} curation preferences.`, 409);
    }

    // Re-adding the same type and value updates its action and priority.
    const [row] = await sql`
      INSERT INTO user_curation_preferences (fid, preference_type, preference_value, action, priority)
      VALUES (${fid}, ${preference_type}, ${value}, ${action}, ${priority})
      ON CONFLICT (fid, preference_type, preference_value)
      DO UPDATE SET action = EXCLUDED.action, priority = EXCLUDED.priority, updated_at = NOW()
      RETURNING *`;
    return NextResponse.json({ ok: true, data: normalizeRow(row) });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    logger.error('Failed to add curation preference', error);
    return handleApiError(error, 'POST /curation');
  }
}

export async function PUT(request: NextRequest) {
  const logger = createApiLogger('/curation PUT');
  try {
    const fid = await verifyFarcasterSignerAuth(request, 'write:lists');
    const body = await request.json().catch(() => null);
    const id = Number(body?.id);
    if (!Number.isSafeInteger(id) || id <= 0) return badRequest('Preference ID required');

    await ensureCurationTable();
    const [existing] = await sql`
      SELECT * FROM user_curation_preferences WHERE id = ${id} AND fid = ${fid}`;
    if (!existing) return badRequest('Preference not found', 404);

    const type = body.preference_type ?? existing.preference_type;
    if (!PREFERENCE_TYPES.has(type)) return badRequest('Invalid preference type');
    const value = cleanValue(type, body.preference_value ?? existing.preference_value);
    if (!value) return badRequest('Invalid preference value');
    const action = body.action ?? existing.action;
    if (!ACTIONS.has(action)) return badRequest('Invalid action');
    const priority = body.priority ?? Number(existing.priority);
    if (!validPriority(priority)) return badRequest('Invalid priority');

    try {
      const [row] = await sql`
        UPDATE user_curation_preferences
        SET preference_type = ${type}, preference_value = ${value},
            action = ${action}, priority = ${priority}, updated_at = NOW()
        WHERE id = ${id} AND fid = ${fid}
        RETURNING *`;
      if (!row) return badRequest('Preference not found', 404);
      return NextResponse.json({ ok: true, data: normalizeRow(row) });
    } catch (error) {
      if (isUniqueViolation(error)) return badRequest('You already have that preference.', 409);
      throw error;
    }
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    logger.error('Failed to update curation preference', error);
    return handleApiError(error, 'PUT /curation');
  }
}

export async function DELETE(request: NextRequest) {
  const logger = createApiLogger('/curation DELETE');
  try {
    const fid = await verifyFarcasterSignerAuth(request, 'write:lists');
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) return badRequest('Preference ID required');

    await ensureCurationTable();
    const deleted = await sql`
      DELETE FROM user_curation_preferences WHERE id = ${id} AND fid = ${fid} RETURNING id`;
    if (!deleted.length) return badRequest('Preference not found', 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    logger.error('Failed to delete curation preference', error);
    return handleApiError(error, 'DELETE /curation');
  }
}
