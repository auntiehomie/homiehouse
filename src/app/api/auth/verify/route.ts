import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/ratelimit'
import { fetchFromHypersnapNodes, HypersnapUnavailableError } from '@/lib/hypersnap-nodes'

/**
 * Verify a Farcaster-native auth challenge.
 *
 * The client builds and signs a protobuf CastAdd message containing
 * `homiehouse-auth-${timestamp}-${nonce}` and POSTs the raw bytes here.
 * We forward to Hypersnap (personal node first, then the fallback nodes) —
 * if a node accepts it, the user has proven key-possession of the FID
 * embedded in the message.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 20 requests/minute per IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
    const { success: rateLimitOk } = await rateLimit(`auth-verify:${ip}`, 20, 60)
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    const messageBytes = await request.arrayBuffer()

    if (!messageBytes.byteLength) {
      return NextResponse.json(
        { ok: false, error: 'Empty message body' },
        { status: 400 }
      )
    }

    const { response: hubRes } = await fetchFromHypersnapNodes('/v1/submitMessage', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: messageBytes as unknown as BodyInit,
      timeoutMs: 10_000,
      label: 'auth/verify',
    })

    const rawText = await hubRes.text()
    let data: any = {}
    try {
      data = JSON.parse(rawText)
    } catch {
      /* non-JSON body — carry on */
    }

    if (!hubRes.ok) {
      const errMsg =
        data?.message ||
        data?.errMsg ||
        data?.error ||
        rawText.slice(0, 300) ||
        `Hub error ${hubRes.status}`
      console.error(
        `[auth/verify] hub ${hubRes.status}: ${errMsg}`,
        JSON.stringify(data)
      )
      return NextResponse.json(
        { ok: false, error: errMsg, hub: data },
        { status: hubRes.status }
      )
    }

    return NextResponse.json({ ok: true, ...data })
  } catch (error: any) {
    if (error instanceof HypersnapUnavailableError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 })
    }
    console.error('[auth/verify] proxy error:', error)
    return NextResponse.json(
      { ok: false, error: error?.message || 'Verification failed' },
      { status: 500 }
    )
  }
}