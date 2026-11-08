import { MAX_MANIFEST_BYTES, NETWORK_CODE_MANIFESTS, validateStickerPack } from '@/lib/sticker-pack';
export async function GET() {
  for (const url of NETWORK_CODE_MANIFESTS) {
    try {
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
      if (!response.ok || !response.body || Number(response.headers.get('content-length')) > MAX_MANIFEST_BYTES) continue;
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > MAX_MANIFEST_BYTES) { await reader.cancel(); throw new Error('Manifest too large'); } chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const pack = validateStickerPack(JSON.parse(new TextDecoder().decode(bytes)));
      return Response.json(pack, {headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'}});
    } catch { /* Try the fixed bundled manifest. */ }
  }
  return Response.json({error:'Sticker pack unavailable. Please try again.'}, {status:503,headers:{'Cache-Control':'no-store'}});
}
