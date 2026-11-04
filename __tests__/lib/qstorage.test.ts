import { buildQStorageImageUrl, getQStorageConfig } from '@/lib/qstorage';

describe('QStorage configuration and media URLs', () => {
  it('disables QStorage when no credentials are configured', () => {
    expect(getQStorageConfig({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('rejects partial QStorage credentials', () => {
    expect(() => getQStorageConfig({ QSTORAGE_BUCKET: 'homiehouse-media' } as NodeJS.ProcessEnv))
      .toThrow('QStorage requires');
  });

  it('uses QStorage global region by default', () => {
    expect(getQStorageConfig({
      QSTORAGE_ACCESS_KEY_ID: 'access-key',
      QSTORAGE_SECRET_ACCESS_KEY: 'secret-key',
      QSTORAGE_BUCKET: 'homiehouse-media',
    } as NodeJS.ProcessEnv)).toMatchObject({
      endpoint: 'https://qstorage.quilibrium.com',
      region: 'q-world-1',
      publicBaseUrl: 'https://homiehouse-media.qstorage.quilibrium.com',
      bucket: 'homiehouse-media',
    });
  });

  it('allows an explicit QStorage region override', () => {
    expect(getQStorageConfig({
      QSTORAGE_ACCESS_KEY_ID: 'access-key',
      QSTORAGE_SECRET_ACCESS_KEY: 'secret-key',
      QSTORAGE_BUCKET: 'homiehouse-media',
      QSTORAGE_REGION: 'custom-region',
    } as NodeJS.ProcessEnv)?.region).toBe('custom-region');
  });

  it('encodes each object-key path segment while preserving folder separators', () => {
    expect(buildQStorageImageUrl('casts/123/photo one.png', 'https://media.example.test/'))
      .toBe('https://media.example.test/casts/123/photo%20one.png');
  });
});
