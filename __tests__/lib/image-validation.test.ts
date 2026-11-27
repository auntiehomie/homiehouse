import { validateImageSignature } from '@/lib/validation';

describe('image content validation', () => {
  it('accepts bytes with a valid PNG signature', async () => {
    const file = new File([
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
    ], 'image.png', { type: 'image/png' });
    await expect(validateImageSignature(file)).resolves.toBeUndefined();
  });

  it('rejects text disguised with an image MIME type', async () => {
    const file = new File(['<script>alert(1)</script>'], 'image.png', { type: 'image/png' });
    await expect(validateImageSignature(file)).rejects.toMatchObject({ field: 'file' });
  });
});
