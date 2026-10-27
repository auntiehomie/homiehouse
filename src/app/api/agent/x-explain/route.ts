/**
 * POST /api/agent/x-explain — test the X post explainer with ZERO X API cost.
 *
 * Body: { "text": "the confusing post text", "author"?: "handle" }
 * Returns: { ok, explanation }
 *
 * This hits only the free LLM stack, not the X API, so you can iterate on the
 * explanation quality/voice for free before ever spending on live X calls.
 */

import { NextRequest, NextResponse } from 'next/server';
import { explainXPost } from '@/lib/ai/x-explain';
import { handleApiError } from '@/lib/errors';
import { checkRateLimit, rateLimitKeyFromRequest } from '@/lib/ratelimit';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 30 requests/minute per IP
    const { success: rateLimitOk } = await checkRateLimit(
      `agent-x-explain:${rateLimitKeyFromRequest(req)}`,
      30,
      60,
    );
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const { text, author } = await req.json().catch(() => ({}));
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ ok: false, error: 'Provide { text: string }' }, { status: 400 });
    }
    if (text.length > 5_000) {
      return NextResponse.json({ ok: false, error: 'Text must be 5,000 characters or fewer' }, { status: 413 });
    }
    const explanation = await explainXPost(text, { author: typeof author === 'string' ? author : undefined });
    return NextResponse.json({ ok: true, explanation });
  } catch (error: any) {
    return handleApiError(error, 'POST /agent/x-explain');
  }
}
