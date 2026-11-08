import { NextRequest, NextResponse } from "next/server";
import { validateImageFile, validateImageSignature } from '@/lib/validation';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { rateLimit } from '@/lib/ratelimit';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import { AuthError } from '@/lib/errors';
import { getQStorageConfig, uploadImageToQStorage } from '@/lib/qstorage';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/upload-image');
  logger.start();

  try {
    const authenticatedFid = await verifyFarcasterSignerAuth(request, 'write:casts');
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success: rlOk } = rateLimit(`upload-image:${ip}`, 20, 3600);
    if (!rlOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fid = formData.get('fid');
    if (fid !== null && Number(fid) !== authenticatedFid) {
      return NextResponse.json({ error: 'FID does not match authenticated user' }, { status: 403 });
    }
    logger.info('Upload request', { fid: authenticatedFid });

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    validateImageFile(file);
    await validateImageSignature(file);

    logger.info('Uploading image', { fileName: file.name, fileType: file.type, fileSize: file.size });

    // Prefer QStorage; use the configured IPFS provider if it is unavailable.
    // Authentication and file validation above apply to every provider.
    try {
      const qstorageConfig = getQStorageConfig();
      if (qstorageConfig) {
        const uploaded = await uploadImageToQStorage(file, String(authenticatedFid));
        logger.success('Uploaded image to QStorage', { key: uploaded.key, url: uploaded.url });
        logger.end();
        return NextResponse.json({ ok: true, url: uploaded.url, key: uploaded.key, provider: 'qstorage' });
      }
    } catch (error: unknown) {
      const qstorageError = error as {
        name?: string;
        message?: string;
        code?: string;
        Code?: string;
        $metadata?: {
          httpStatusCode?: number;
          requestId?: string;
          extendedRequestId?: string;
        };
      };
      logger.error('QStorage upload failed', {
        name: qstorageError?.name,
        message: qstorageError?.message,
        code: qstorageError?.Code || qstorageError?.code,
        status: qstorageError?.$metadata?.httpStatusCode,
        requestId: qstorageError?.$metadata?.requestId,
        extendedRequestId: qstorageError?.$metadata?.extendedRequestId,
      });
    }

    // ── 1. Try Pinata IPFS ───────────────────────────────────────────────────
    const pinataJwt = process.env.PINATA_JWT;
    if (pinataJwt) {
      try {
        const pinataForm = new FormData();
        pinataForm.append('file', file, file.name);
        // Add metadata so the file is easily identifiable in Pinata dashboard
        pinataForm.append('pinataMetadata', JSON.stringify({
          name: `homiehouse-cast-${Date.now()}-${file.name}`,
          keyvalues: { source: 'homiehouse', fid: String(authenticatedFid) },
        }));
        pinataForm.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

        const pinRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: { Authorization: `Bearer ${pinataJwt}` },
          body: pinataForm,
          signal: AbortSignal.timeout(30000),
        });

        if (pinRes.ok) {
          const pinData = await pinRes.json();
          const cid = pinData.IpfsHash;
          if (cid) {
            // Use Pinata's public gateway; falls back to ipfs.io
            const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud';
            const url = `${gateway}/ipfs/${cid}`;
            logger.success('Uploaded to IPFS via Pinata', { cid, url });
            logger.end();
            return NextResponse.json({ ok: true, url, cid, provider: 'ipfs' });
          }
        } else {
          const err = await pinRes.text().catch(() => '');
          logger.warn('Pinata upload failed, falling back', { status: pinRes.status, err });
        }
      } catch (e: any) {
        logger.warn('Pinata upload error, falling back', { error: e.message });
      }
    }

    // ── 2. Fall back to imgbb ────────────────────────────────────────────────
    const imgbbApiKey = process.env.IMGBB_API_KEY;
    if (!imgbbApiKey) {
      return NextResponse.json(
        { error: 'Image upload not configured. Add PINATA_JWT or IMGBB_API_KEY.' },
        { status: 500 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const imgbbForm = new FormData();
    imgbbForm.append('key', imgbbApiKey);
    imgbbForm.append('image', base64);

    const imgbbRes = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: imgbbForm,
    });

    if (!imgbbRes.ok) {
      const errorText = await imgbbRes.text();
      logger.error('imgbb upload failed', { status: imgbbRes.status, error: errorText });
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    const result = await imgbbRes.json();
    if (!result.data?.url) {
      return NextResponse.json({ error: 'Upload succeeded but no URL returned' }, { status: 500 });
    }

    logger.success('Uploaded to imgbb (fallback)', { url: result.data.url });
    logger.end();
    return NextResponse.json({ ok: true, url: result.data.url, deleteUrl: result.data.delete_url, provider: 'imgbb' });

  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('Upload failed', error);
    return handleApiError(error, 'POST /upload-image');
  }
}
