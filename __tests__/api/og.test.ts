import { NextRequest } from 'next/server';
import { GET as getDefaultOG } from '@/app/api/og/route';
import { GET as getContentOG } from '@/app/api/og/content/route';
import { GET as getCastOG } from '@/app/api/og/cast/route';

/**
 * Integration tests for /api/og/* endpoints
 * Verifies image generation params, response headers, and content.
 */

// next/og ImageResponse is edge-rendered; mock it for jest
jest.mock('next/og', () => ({
  ImageResponse: class MockImageResponse {
    body: ReadableStream<Uint8Array>;
    status: number;
    headers: Map<string, string>;

    constructor(_jsx: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('mock-image-data'));
          controller.close();
        },
      });
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? { 'content-type': 'image/png' }));
    }
  },
}));

// Mock fetchCast for the cast OG route
jest.mock('@/lib/hypersnap', () => ({
  fetchCast: jest.fn().mockResolvedValue({ cast: { author: { username: 'test', display_name: 'Test', pfp_url: '' }, text: 'Hello' } }),
}));

describe('GET /api/og (default)', () => {
  it('returns 200 with image content-type', async () => {
    const res = await getDefaultOG();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image');
  });

  it('returns a readable body stream', async () => {
    const res = await getDefaultOG();
    expect(res.body).toBeDefined();
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const { value, done } = await reader.read();
    expect(done).toBe(false);
    expect(value).toBeDefined();
  });
});

describe('GET /api/og/content', () => {
  it('returns 200 with image content-type for valid params', async () => {
    const req = new NextRequest('http://localhost:3000/api/og/content?title=Test%20Article&description=Test%20Description&kind=blog');
    const res = await getContentOG(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image');
  });

  it('still returns 200 when missing optional params', async () => {
    const req = new NextRequest('http://localhost:3000/api/og/content');
    const res = await getContentOG(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image');
  });

  it('handles special characters in title and description', async () => {
    const req = new NextRequest('http://localhost:3000/api/og/content?title=Test%20%E2%9C%A8%20Article&description=Description%20with%20emoji%20%F0%9F%9A%80');
    const res = await getContentOG(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image');
  });
});

describe('GET /api/og/cast', () => {
  it('returns 200 with image content-type for valid cast params', async () => {
    const req = new NextRequest('http://localhost:3000/api/og/cast?author=testuser&text=Hello%20World&pfp=https://example.com/avatar.png');
    const res = await getCastOG(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image');
  });

  it('still returns 200 when missing optional params', async () => {
    const req = new NextRequest('http://localhost:3000/api/og/cast');
    const res = await getCastOG(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image');
  });

  it('handles long cast text without error', async () => {
    const longText = 'A'.repeat(500);
    const req = new NextRequest(`http://localhost:3000/api/og/cast?author=user&text=${encodeURIComponent(longText)}`);
    const res = await getCastOG(req);
    expect(res.status).toBe(200);
  });
});
