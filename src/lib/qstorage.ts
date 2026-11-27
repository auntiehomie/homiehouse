import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { safeFetchPublicUrl } from './safe-public-fetch';

export interface QStorageConfig {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region: string;
  publicBaseUrl: string;
}

export function getQStorageConfig(env: NodeJS.ProcessEnv = process.env): QStorageConfig | null {
  const accessKeyId = env.QSTORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.QSTORAGE_SECRET_ACCESS_KEY?.trim();
  const bucket = env.QSTORAGE_BUCKET?.trim();
  const configuredCount = [accessKeyId, secretAccessKey, bucket].filter(Boolean).length;
  if (!configuredCount) return null;
  if (configuredCount !== 3) {
    throw new Error('QStorage requires QSTORAGE_ACCESS_KEY_ID, QSTORAGE_SECRET_ACCESS_KEY, and QSTORAGE_BUCKET.');
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket!)) {
    throw new Error('QSTORAGE_BUCKET must be a valid lowercase QStorage bucket name.');
  }

  const endpoint = env.QSTORAGE_ENDPOINT?.trim() || 'https://qstorage.quilibrium.com';
  const region = env.QSTORAGE_REGION?.trim() || 'q-world-1';
  const publicBaseUrl = env.QSTORAGE_PUBLIC_BASE_URL?.trim() || `https://${bucket}.qstorage.quilibrium.com`;
  const parsedEndpoint = new URL(endpoint);
  const parsedPublicBaseUrl = new URL(publicBaseUrl);
  if (parsedEndpoint.protocol !== 'https:' || parsedPublicBaseUrl.protocol !== 'https:') {
    throw new Error('QStorage endpoint and public URL must use HTTPS.');
  }

  return { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, bucket: bucket!, endpoint, region, publicBaseUrl: publicBaseUrl.replace(/\/+$/, '') };
}

let client: S3Client | null = null;
let clientConfigKey = '';

function getClient(config: QStorageConfig): S3Client {
  const key = `${config.accessKeyId}\n${config.secretAccessKey}\n${config.endpoint}\n${config.region}`;
  if (!client || key !== clientConfigKey) {
    client?.destroy();
    client = createQStorageS3Client(config);
    clientConfigKey = key;
  }
  return client;
}

export function createQStorageS3Client(config: QStorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

function extensionForImage(file: File): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  const extension = extensions[file.type.toLowerCase()];
  if (!extension) throw new Error('Unsupported QStorage image type.');
  return extension;
}

export function buildQStorageImageUrl(key: string, publicBaseUrl: string): string {
  const base = publicBaseUrl.replace(/\/+$/, '');
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function verifyQStoragePublicImage(url: string, expected: Uint8Array): Promise<void> {
  // A successful authenticated PUT does not prove that cast readers can GET it.
  // Use the exact permanent URL, without credentials or a signed query string.
  const response = await safeFetchPublicUrl(url, {
    headers: { 'Cache-Control': 'no-cache' },
    timeoutMs: 10000,
    maxBytes: expected.byteLength,
    maxRedirects: 0,
  });
  if (!response.ok) {
    throw new Error(`QStorage public image verification failed (HTTP ${response.status}). Check object public access and QSTORAGE_PUBLIC_BASE_URL.`);
  }
  if (!response.headers.get('content-type')?.toLowerCase().startsWith('image/')) {
    throw new Error('QStorage public URL did not return an image.');
  }
  const actual = new Uint8Array(await response.arrayBuffer());
  if (actual.length !== expected.length || actual.some((byte, index) => byte !== expected[index])) {
    throw new Error('QStorage public URL returned different image bytes.');
  }
}

export async function uploadImageToQStorage(file: File, fid?: string | null): Promise<{ key: string; url: string }> {
  const config = getQStorageConfig();
  if (!config) throw new Error('QStorage is not configured.');

  const key = `casts/${fid && /^\d+$/.test(fid) ? fid : 'unknown'}/${crypto.randomUUID()}.${extensionForImage(file)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await getClient(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: bytes,
    ContentLength: file.size,
    ContentType: file.type,
    CacheControl: 'public, max-age=31536000, immutable',
    ACL: 'public-read',
  }));
  const url = buildQStorageImageUrl(key, config.publicBaseUrl);
  await verifyQStoragePublicImage(url, bytes);
  return { key, url };
}
