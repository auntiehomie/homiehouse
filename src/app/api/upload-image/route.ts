import { NextRequest, NextResponse } from "next/server";
import { validateImageFile } from '@/lib/validation';
import { handleApiError } from '@/lib/errors';
import { createApiLogger } from '@/lib/logger';
import { rateLimit } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  const logger = createApiLogger('/upload-image');
  logger.start();

  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success: rlOk } = rateLimit(`upload-image:${ip}`, 20, 3600);
    if (!rlOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fid = formData.get('fid');
    logger.info('Upload request', { fid: fid ? Number(fid) : 'unknown' });

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    validateImageFile(file);

    logger.info('Uploading image', { fileName: file.name, fileType: file.type, fileSize: file.size });

    // ── 1. Try Pinata IPFS ───────────────────────────────────────────────────
    const pinataJwt = process.env.PINATA_JWT;
    if (pinataJwt) {
      try {
        const pinataForm = new FormData();
        pinataForm.append('file', file, file.name);
        // Add metadata so the file is easily identifiable in Pinata dashboard
        pinataForm.append('pinataMetadata', JSON.stringify({
          name: `homiehouse-cast-${Date.now()}-${file.name}`,
          keyvalues: { source: 'homiehouse', fid: fid ? String(fid) : '' },
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
    logger.error('Upload failed', error);
    return handleApiError(error, 'POST /upload-image');
  }
}
