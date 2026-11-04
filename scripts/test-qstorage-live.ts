import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { buildQStorageImageUrl, getQStorageConfig } from '../src/lib/qstorage';

async function main() {
  const config = getQStorageConfig();
  if (!config) {
    console.error('QStorage live test not run: set QSTORAGE_ACCESS_KEY_ID, QSTORAGE_SECRET_ACCESS_KEY, and QSTORAGE_BUCKET.');
    process.exitCode = 2;
    return;
  }

  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: false,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const key = `homiehouse-live-test/${randomUUID()}.png`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=', 'base64');
  let uploaded = false;

  try {
    await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: png,
      ContentLength: png.byteLength,
      ContentType: 'image/png',
      CacheControl: 'no-cache',
      ACL: 'public-read',
    }));
    uploaded = true;

    const url = buildQStorageImageUrl(key, config.publicBaseUrl);
    const response = await fetch(`${url}?live-test=${Date.now()}`, { cache: 'no-store' });
    const body = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error(`Public URL fetch failed with HTTP ${response.status}.`);
    if (!response.headers.get('content-type')?.toLowerCase().includes('image/png')) {
      throw new Error('Public URL did not return an image/png content type.');
    }
    if (!body.equals(png)) throw new Error('Public URL returned bytes different from the uploaded test image.');

    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    uploaded = false;
    try {
      await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
      throw new Error('QStorage still returns the object after deletion.');
    } catch (error: unknown) {
      const statusCode = typeof error === 'object' && error !== null && '$metadata' in error
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined;
      if (!(error instanceof Error && error.name === 'NotFound') && statusCode !== 404) throw error;
    }

    console.log('QStorage live test passed: upload, anonymous public read, content type, byte integrity, and object deletion.');
  } finally {
    if (uploaded) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key })).catch(() => {});
    }
    client.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(`QStorage live test failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
});
