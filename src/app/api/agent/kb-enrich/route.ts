/**
 * Cron: /api/agent/kb-enrich
 *
 * Enriches KB articles that have media URLs (YouTube, podcasts) but no summary.
 * Fetches YouTube captions via HTTP, generates summaries via LLM, and upserts
 * results back into the kb_articles table.
 *
 * Runs daily at 1PM UTC (1 hour after kb-sync).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { enrichPendingMediaArticles } from '@/lib/kb-enrich';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    verifyCronSecret(request, process.env.CRON_SECRET);

    const result = await enrichPendingMediaArticles();

    console.log(
      `[agent/kb-enrich] DONE: ` +
      `enriched=${result.enriched.filter((r) => r.status === 'enriched').length} ` +
      `errors=${result.errors.length}`,
    );

    return NextResponse.json({
      ok: result.ok,
      enriched: result.enriched.filter((r) => r.status === 'enriched').length,
      total: result.enriched.length,
      errors: result.errors,
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    console.error('[agent/kb-enrich] Error:', error?.message);
    return handleApiError(error, 'GET /agent/kb-enrich');
  }
}