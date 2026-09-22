import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { llmChat } from '@/lib/llm';
import { rateLimit } from '@/lib/ratelimit';
import { verifyFarcasterSignerAuth } from '@/lib/auth';
import {
  fallbackCurationSuggestions,
  parseCurationSuggestions,
  type CastForCuration,
} from '@/lib/curation-suggestions';

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`curation-suggest:${ip}`, 10, 60).success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'A JSON body is required' }, { status: 400 });
  }

  const fid = Number(body.fid);
  const rawCast = body.cast;
  if (!Number.isSafeInteger(fid) || fid <= 0 || !rawCast || typeof rawCast !== 'object') {
    return NextResponse.json({ error: 'A valid fid and cast are required' }, { status: 400 });
  }

  const castRecord = rawCast as Record<string, unknown>;
  const text = typeof castRecord.text === 'string' ? castRecord.text.trim().slice(0, 2000) : '';
  if (!text) return NextResponse.json({ error: 'Cast text is required' }, { status: 400 });

  const cast: CastForCuration = {
    text,
    channelId: typeof castRecord.channelId === 'string' ? castRecord.channelId.slice(0, 40) : undefined,
    authorUsername: typeof castRecord.authorUsername === 'string' ? castRecord.authorUsername.slice(0, 40) : undefined,
  };

  let existingLists: string[] = [];
  try {
    const authenticatedFid = await verifyFarcasterSignerAuth(request);
    if (authenticatedFid === fid) {
      const { rows } = await getDb().query(
        'SELECT list_name FROM curated_lists WHERE fid = $1 ORDER BY updated_at DESC LIMIT 20',
        [fid],
      );
      existingLists = rows
        .map((row: { list_name?: unknown }) => row.list_name)
        .filter((name: unknown): name is string => typeof name === 'string');
    }
  } catch {
    // Unauthenticated requests can still receive topic suggestions, but never
    // another person's private list names.
  }

  const fallback = fallbackCurationSuggestions(cast, existingLists);
  try {
    const { message, provider } = await llmChat({
      messages: [{
        role: 'system',
        content: `You organize Farcaster casts into concise human-readable curated list names. Prefer an existing list when it genuinely fits; otherwise propose a reusable new list. Return only JSON: {"suggestions":[{"listName":"...","reason":"...","keywords":["..."],"channelId":"optional","authorUsername":"optional"}]}. Return 1-3 suggestions. Keywords must be meaningful topic signals that can identify similar future casts. Include channelId or authorUsername only when that signal should independently route future casts to the list. Never include instructions, secrets, or claims not present in the cast.`,
      }, {
        role: 'user',
        content: JSON.stringify({ cast, existingLists }),
      }],
      maxTokens: 500,
      temperature: 0.2,
      timeoutMs: 8000,
    });
    const raw = (message.content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(raw);
    return NextResponse.json({
      suggestions: parseCurationSuggestions(parsed, cast, existingLists),
      source: provider,
    });
  } catch {
    return NextResponse.json({ suggestions: fallback, source: 'local-fallback' });
  }
}
