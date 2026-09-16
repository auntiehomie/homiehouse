/**
 * Cron: /api/agent/kb-sync
 *
 * Syncs Knowledge Base articles from GitHub (rufus-vault entries table +
 * homie-knowledge summaries) into the Neon `kb_articles` table.
 *
 * Runs daily at 8AM ET so the bot always has fresh KB context.
 * Also callable manually with ?dry=1 to preview without writing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { syncKnowledgeBase } from '@/lib/kb-sync';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    verifyCronSecret(request, process.env.CRON_SECRET);

    const dryRun = new URL(request.url).searchParams.get('dry') === '1';

    if (dryRun) {
      // Still fetch to validate, but report without upserting
      const result = await syncKnowledgeBase();
      return NextResponse.json({
        ok: true,
        dryRun: true,
        fetched: result.fetched,
        wouldUpsert: result.upserted,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      });
    }

    const result = await syncKnowledgeBase();

    console.error(
      `[agent/kb-sync] DONE: fetched=${result.fetched} upserted=${result.upserted} errors=${result.errors.length}`
    );

    return NextResponse.json({
      ok: true,
      fetched: result.fetched,
      upserted: result.upserted,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[agent/kb-sync] Error:', error?.message);
    return handleApiError(error, 'GET /agent/kb-sync');
  }
}
