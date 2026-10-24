/**
 * Cron: /api/agent/kb-sync
 *
 * Syncs Knowledge Base article links and processed article context from the
 * Rufus-vault Knowledge Base files into the Neon `kb_articles` table.
 *
 * Runs hourly at minute 30 UTC so the bot always has fresh KB context.
 * Also callable manually with ?dry=1 to preview without writing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { syncKnowledgeBase } from '@/lib/kb-sync';
import { captureMessage } from '@sentry/nextjs';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    verifyCronSecret(request, process.env.CRON_SECRET);

    const dryRun = new URL(request.url).searchParams.get('dry') === '1';

    if (dryRun) {
      // Still fetch to validate, but report without upserting
      const result = await syncKnowledgeBase({ dryRun: true });
      return NextResponse.json({
        ok: result.errors.length === 0,
        dryRun: true,
        fetched: result.fetched,
        wouldUpsert: result.wouldUpsert ?? 0,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await syncKnowledgeBase();
    const semanticallyIndexed = result.semanticallyIndexed ?? 0;
    const ok = result.errors.length === 0 && result.upserted > 0 && (result.usable ?? 0) > 0;

    const log = ok ? console.info : console.error;
    log(
      `[agent/kb-sync] DONE: fetched=${result.fetched} upserted=${result.upserted} usable=${result.usable ?? 0} semanticallyIndexed=${semanticallyIndexed} errors=${result.errors.length}`
    );

    if (!ok) {
      console.error('[agent/kb-sync] failures:', result.errors.slice(0, 3));
      captureMessage('Knowledge-base sync failed', {
        level: 'error',
        extra: { fetched: result.fetched, upserted: result.upserted, usable: result.usable ?? 0, errorCount: result.errors.length },
      });
    }

    return NextResponse.json({
      ok,
      fetched: result.fetched,
      upserted: result.upserted,
      usable: result.usable ?? 0,
      semanticallyIndexed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    }, { status: ok ? 200 : 503 });
  } catch (error: any) {
    console.error('[agent/kb-sync] Error:', error?.message);
    captureMessage('Knowledge-base sync crashed', { level: 'error' });
    return handleApiError(error, 'GET /agent/kb-sync');
  }
}
