import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import { rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const STYLE_PROMPTS: Record<string, string> = {
  campus: 'a warm digital campus portrait with confident collegiate fashion-editorial energy, expressive community atmosphere, polished portrait lighting',
  lounge: 'a creative campus lounge portrait with bold personal style, rich textiles, expressive color, warm social energy, polished editorial lighting',
  night: 'a late-night campus arts portrait with deep indigo and purple atmosphere, luminous green accents, thoughtful confident expression, cinematic but welcoming light',
  courtyard: 'a sunlit campus courtyard portrait with relaxed expressive fashion, lush greenery, vibrant community atmosphere, warm editorial photography',
};

const ALLOWED_IMAGE_HOSTS = [
  'pbs.twimg.com',
  'imagedelivery.net',
  'res.cloudinary.com',
  'gateway.pinata.cloud',
  'warpcast.com',
  'storage.farcaster.xyz',
  'cdn.farcaster.xyz',
];

function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

async function readSource(formData: FormData): Promise<{ bytes: Buffer; type: string }> {
  const uploaded = formData.get('image');
  if (uploaded instanceof File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(uploaded.type) || uploaded.size > 8 * 1024 * 1024) {
      throw new Error('Upload a JPG, PNG, or WebP image under 8 MB.');
    }
    return { bytes: Buffer.from(await uploaded.arrayBuffer()), type: uploaded.type };
  }

  const imageUrl = String(formData.get('imageUrl') || '');
  if (!isAllowedImageUrl(imageUrl)) throw new Error('Use a supported Farcaster or X profile picture, or upload an image.');
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(8000), redirect: 'error' });
  if (!response.ok) throw new Error('Could not read the selected profile picture.');
  const type = response.headers.get('content-type')?.split(';')[0] || '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('The selected profile picture is not a supported image.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) throw new Error('The selected profile picture is too large.');
  return { bytes, type };
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`pfp-generate:${ip}`, 4, 60 * 60).success) {
    return NextResponse.json({ error: 'Generation limit reached for this hour. Try again later.' }, { status: 429 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'PFP generation is not configured yet.' }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    if (formData.get('consent') !== 'true') {
      return NextResponse.json({ error: 'Confirm that you have permission to use this photo.' }, { status: 400 });
    }
    const style = String(formData.get('style') || 'campus');
    if (!STYLE_PROMPTS[style]) return NextResponse.json({ error: 'Choose a listed portrait style.' }, { status: 400 });

    const { bytes, type } = await readSource(formData);
    const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await client.images.edit({
      model: 'gpt-image-1',
      image: await toFile(bytes, `profile.${extension}`, { type }),
      prompt: `Transform this supplied profile photo into an original Homiehouse digital-campus PFP. ${STYLE_PROMPTS[style]}. Keep the same person's recognizable face, skin tone, facial structure, hair texture and style, and distinctive features. Do not change their identity or age. Homiehouse visual palette: charcoal, rich purple, vivid green accents, warm cream highlights. Centered head-and-shoulders portrait, square crop, clear at small avatar size. Original artwork only; do not reproduce any existing television character, actor, logo, or exact scene.`,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'png',
    });
    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) return NextResponse.json({ error: 'Image generation returned no image. Try again.' }, { status: 502 });
    return NextResponse.json({ imageBase64, mimeType: 'image/png' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image generation failed.';
    const status = /permission|upload|supported|profile picture|too large|Choose/.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
