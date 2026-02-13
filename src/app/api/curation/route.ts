import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { validateFid } from '@/lib/validation';
import { verifySignerAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const logger = createApiLogger('/curation');
  logger.start();

  try {
    const { searchParams } = new URL(request.url);
    const fidParam = searchParams.get("fid");
    const type = searchParams.get("type");

    if (!fidParam) {
      return NextResponse.json({ ok: false, error: "FID required" }, { status: 400 });
    }

    // Validate FID
    const fid = validateFid(fidParam);
    logger.info('Fetching curation preferences', { fid, type });

    const serverUrl = process.env.SERVER_URL || "http://localhost:3001";
    let url = `${serverUrl}/api/curation?fid=${fid}`;
    if (type) {
      url += `&type=${encodeURIComponent(type)}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    logger.success('Preferences fetched', { count: data?.preferences?.length || 0 });
    logger.end();
    return NextResponse.json(data);
  } catch (error: any) {
    logger.error('Failed to fetch curation preferences', error);
    return handleApiError(error, 'GET /curation');
  }
}

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/curation POST');
  logger.start();

  try {
    const body = await request.json();
    const { fid, preference_type, preference_value, action, priority, signerUuid } = body;

    if (!preference_type || !preference_value || !action) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // SECURITY: Require signer authentication
    if (!signerUuid) {
      return NextResponse.json({ ok: false, error: 'signerUuid is required' }, { status: 401 });
    }
    const verifiedFid = await verifySignerAuth(signerUuid);

    const validatedFid = verifiedFid;
    logger.info('Adding curation preference', { fid: validatedFid, preference_type, action });

    const serverUrl = process.env.SERVER_URL || "http://localhost:3001";
    const res = await fetch(`${serverUrl}/api/curation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fid: validatedFid,
        preference_type,
        preference_value,
        action,
        priority: priority || 0,
      }),
    });

    const data = await res.json();
    logger.success('Preference added', { preferenceId: data?.preference?.id });
    logger.end();
    return NextResponse.json(data);
  } catch (error: any) {
    logger.error('Failed to add curation preference', error);
    return handleApiError(error, 'POST /curation');
  }
}

export async function PUT(request: NextRequest) {
  const logger = createApiLogger('/curation PUT');
  logger.start();

  try {
    const body = await request.json();
    const { id, signerUuid, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Preference ID required" },
        { status: 400 }
      );
    }

    // SECURITY: Require signer authentication
    if (!signerUuid) {
      return NextResponse.json({ ok: false, error: 'signerUuid is required' }, { status: 401 });
    }
    await verifySignerAuth(signerUuid);

    logger.info('Updating curation preference', { id });

    const serverUrl = process.env.SERVER_URL || "http://localhost:3001";
    const res = await fetch(`${serverUrl}/api/curation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });

    const data = await res.json();
    logger.success('Preference updated', { id });
    logger.end();
    return NextResponse.json(data);
  } catch (error: any) {
    logger.error('Failed to update preference', error);
    return handleApiError(error, 'PUT /curation');
  }
}

export async function DELETE(request: NextRequest) {
  const logger = createApiLogger('/curation DELETE');
  logger.start();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const signerUuid = searchParams.get("signerUuid");

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Preference ID required" },
        { status: 400 }
      );
    }

    // SECURITY: Require signer authentication
    if (!signerUuid) {
      return NextResponse.json({ ok: false, error: 'signerUuid is required' }, { status: 401 });
    }
    await verifySignerAuth(signerUuid);

    logger.info('Deleting curation preference', { id });

    const serverUrl = process.env.SERVER_URL || "http://localhost:3001";
    const res = await fetch(`${serverUrl}/api/curation?id=${id}`, {
      method: "DELETE",
    });

    const data = await res.json();
    logger.success('Preference deleted', { id });
    logger.end();
    return NextResponse.json(data);
  } catch (error: any) {
    logger.error('Failed to delete preference', error);
    return handleApiError(error, 'DELETE /curation');
  }
}
