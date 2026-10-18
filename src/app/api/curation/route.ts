import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, AuthError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid } from '@/lib/validation';
import { verifyFarcasterSignerAuth } from '@/lib/auth';

const serverUrl = (process.env.SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');
const preferenceTypes = new Set(['keyword', 'channel', 'author', 'content_type', 'min_likes', 'max_length']);

async function getOwnedPreferences(fid: number): Promise<any[]> {
  const response = await fetch(`${serverUrl}/api/curation?fid=${fid}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Curation service unavailable');
  const data = await response.json();
  if (!data?.ok || !Array.isArray(data.preferences)) throw new Error('Curation service returned an invalid response');
  return data.preferences;
}

function authError(error: unknown) {
  return error instanceof AuthError
    ? NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    : null;
}

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/curation');
  try {
    const fid = await verifyFarcasterSignerAuth(request, 'read:all');
    const fidParam = request.nextUrl.searchParams.get('fid');
    if (fidParam && validateFid(fidParam) !== fid) {
      return NextResponse.json({ ok: false, error: 'You can only read your own preferences' }, { status: 403 });
    }
    const type = request.nextUrl.searchParams.get('type');
    const url = new URL(`${serverUrl}/api/curation`);
    url.searchParams.set('fid', String(fid));
    if (type) url.searchParams.set('type', type);
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
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
      return NextResponse.json({ ok: false, error: 'Authenticated FID does not match request' }, { status: 403 });
    }
    const { preference_type, preference_value, action, priority } = body;
    if (!preferenceTypes.has(preference_type)
      || typeof preference_value !== 'string' || !preference_value.trim() || preference_value.length > 500
      || !['include', 'exclude'].includes(action)
      || (priority !== undefined && (!Number.isInteger(priority) || Math.abs(priority) > 100))) {
      return NextResponse.json({ ok: false, error: 'Invalid curation preference' }, { status: 400 });
    }

    const response = await fetch(`${serverUrl}/api/curation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fid, preference_type, preference_value: preference_value.trim(), action, priority: priority ?? 0 }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
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
    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'Preference ID required' }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (body.preference_type !== undefined) {
      if (!preferenceTypes.has(body.preference_type)) return NextResponse.json({ ok: false, error: 'Invalid preference type' }, { status: 400 });
      updates.preference_type = body.preference_type;
    }
    if (body.preference_value !== undefined) {
      if (typeof body.preference_value !== 'string' || !body.preference_value.trim() || body.preference_value.length > 500) return NextResponse.json({ ok: false, error: 'Invalid preference value' }, { status: 400 });
      updates.preference_value = body.preference_value.trim();
    }
    if (body.action !== undefined) {
      if (!['include', 'exclude'].includes(body.action)) return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
      updates.action = body.action;
    }
    if (body.priority !== undefined) {
      if (!Number.isInteger(body.priority) || Math.abs(body.priority) > 100) return NextResponse.json({ ok: false, error: 'Invalid priority' }, { status: 400 });
      updates.priority = body.priority;
    }

    const preferences = await getOwnedPreferences(fid);
    if (!preferences.some((preference) => Number(preference.id) === id)) {
      return NextResponse.json({ ok: false, error: 'Preference not found' }, { status: 404 });
    }
    const response = await fetch(`${serverUrl}/api/curation`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }), signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
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
    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: 'Preference ID required' }, { status: 400 });
    }
    const preferences = await getOwnedPreferences(fid);
    if (!preferences.some((preference) => Number(preference.id) === id)) {
      return NextResponse.json({ ok: false, error: 'Preference not found' }, { status: 404 });
    }
    const response = await fetch(`${serverUrl}/api/curation?id=${id}&fid=${fid}`, {
      method: 'DELETE', signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    logger.error('Failed to delete curation preference', error);
    return handleApiError(error, 'DELETE /curation');
  }
}
