/**
 * KB enrichment pipeline — fetches transcripts from YouTube (or other media
 * with captions) and generates summaries via LLM for kb_articles entries that
 * have media URLs but no summary.
 *
 * Designed for Vercel serverless: YouTube caption extraction uses HTTP fetch
 * (self-contained, no yt-dlp or external tools). Audio-only content is skipped
 * with a warning unless DEEPGRAM_API_KEY is configured (serverless-safe).
 */

import { sql } from '@/lib/db';
import { llmChat } from '@/lib/llm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrichResult {
  articleId: number;
  title: string;
  url: string;
  status: 'enriched' | 'skipped_captions' | 'skipped_audio' | 'skipped_no_url' | 'error';
  error?: string;
}

export interface EnrichSummary {
  ok: boolean;
  enriched: EnrichResult[];
  errors: string[];
  timestamp: string;
}

// ─── Media URL detection ──────────────────────────────────────────────────────

const MEDIA_PATTERNS = [
  /youtube\.com\/watch\?v=/i,
  /youtu\.be\//i,
  /youtube\.com\/shorts\//i,
  /open\.spotify\.com\/episode\//i,
  /open\.spotify\.com\/show\//i,
  /podcasts\.apple\.com\//i,
  /anchor\.fm\//i,
  /podbean\.com\//i,
  /buzzsprout\.com\//i,
  /transistor\.fm\//i,
  /simplecast\.com\//i,
  /libsyn\.com\//i,
  /megaphone\.fm\//i,
  /spreaker\.com\//i,
  /castbox\.fm\//i,
];

function isMediaUrl(url: string | null): boolean {
  if (!url) return false;
  return MEDIA_PATTERNS.some((p) => p.test(url));
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i.test(url);
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// ─── YouTube transcript extraction (self-contained, no deps) ──────────────────

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  vssId?: string;
  kind?: string;
}

/**
 * Fetch the YouTube watch page and extract caption track URLs from the
 * embedded ytInitialPlayerResponse JSON blob.
 */
async function extractCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(watchUrl, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (compatible; HomieHouseBot/1.0; +https://homiehouse.xyz)',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`YouTube watch page returned ${res.status}`);
  const html = await res.text();

  // Strategy 1: Extract captionTracks from ytInitialPlayerResponse
  const playerResponse = extractPlayerResponse(html);
  if (playerResponse) {
    const tracks = parseCaptionTracksFromResponse(playerResponse);
    if (tracks.length > 0) return tracks;
  }

  // Strategy 2: Find captionTracks directly in the page (older format)
  const captionTracksMatch = html.match(/"captionTracks"\s*:\s*(\[[^\]]*?\])/s);
  if (captionTracksMatch) {
    try {
      const tracks = JSON.parse(captionTracksMatch[1]);
      return tracks.filter((t: any) => t && t.baseUrl);
    } catch {
      // Fall through to strategy 3
    }
  }

  // Strategy 3: Try the timedtext API directly (works for some videos)
  try {
    const timedTextUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`;
    const ttRes = await fetch(timedTextUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (ttRes.ok) {
      const ttBody = await ttRes.text();
      if (ttBody && !ttBody.includes('<transcript_list ') && ttBody.length > 100) {
        // We got actual captions, not just a listing
        return [{ baseUrl: timedTextUrl, languageCode: 'en' }];
      }
      // It's a <transcript_list> — parse available languages
      const langMatch = ttBody.match(/lang_code="([^"]+)"/g);
      if (langMatch) {
        // Prefer English, fall back to first available or auto-generated
        const enTrack = ttBody.match(/lang_code="en[^"]*"/);
        const targetLang = enTrack ? 'en' : (langMatch[0]?.match(/lang_code="([^"]+)"/)?.[1] ?? 'en');
        return [{ baseUrl: `https://www.youtube.com/api/timedtext?lang=${targetLang}&v=${videoId}`, languageCode: targetLang }];
      }
    }
  } catch {
    // Timedtext unavailable
  }

  return [];
}

/**
 * Extract ytInitialPlayerResponse JSON from the YouTube page HTML.
 */
function extractPlayerResponse(html: string): string | null {
  // Pattern: ytInitialPlayerResponse = {...};
  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
  if (!match) return null;

  let json = match[1];
  // Balance braces in case the simple regex cut too early
  let depth = 0;
  let inString = false;
  let escaped = false;
  let endIndex = json.length;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }
  return json.slice(0, endIndex);
}

/**
 * Parse caption tracks from the player response JSON.
 */
function parseCaptionTracksFromResponse(responseJson: string): CaptionTrack[] {
  try {
    const obj = JSON.parse(responseJson);
    const playerCaptions = obj?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(playerCaptions)) return [];
    return playerCaptions.filter((t: any) => t?.baseUrl);
  } catch {
    return [];
  }
}

/**
 * Fetch a VTT caption track and parse it to plain text.
 */
async function fetchAndParseVTT(captionUrl: string): Promise<string> {
  const res = await fetch(captionUrl, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Caption fetch returned ${res.status}`);
  const body = await res.text();

  // Check if it's a JSON/SRV3 caption format
  if (body.trim().startsWith('{') || body.trim().startsWith('<transcript>')) {
    return parseSRV3OrXML(body);
  }

  // WEBVTT format
  return parseWebVTT(body);
}

/**
 * Parse WEBVTT to plain text. Strips timestamps, cue identifiers, and styling.
 */
function parseWebVTT(vtt: string): string {
  const lines = vtt.split('\n');
  const textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip header, timestamps, blank lines, and style tags
    if (
      !trimmed ||
      trimmed.startsWith('WEBVTT') ||
      trimmed.startsWith('NOTE') ||
      /^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(trimmed) ||
      trimmed.startsWith('Kind:') ||
      trimmed.startsWith('Language:')
    ) {
      continue;
    }
    // Skip cue numbers (pure digits)
    if (/^\d+$/.test(trimmed)) continue;
    // Strip inline tags like <c>, </c>, <00:00:01.000>
    const clean = trimmed
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    if (clean) textLines.push(clean);
  }

  return textLines.join('\n');
}

/**
 * Parse SRV3 (JSON) or XML timedtext format to plain text.
 */
function parseSRV3OrXML(raw: string): string {
  // Try JSON (SRV3 format)
  try {
    const obj = JSON.parse(raw);
    const events = obj?.events || obj?.results?.transcripts?.[0]?.results || [];
    const texts: string[] = [];
    for (const event of events) {
      const segs = event?.segs || event?.alternatives?.[0]?.words || [];
      for (const seg of segs) {
        const word = seg?.utf8 ?? seg?.word ?? '';
        if (word) texts.push(word);
      }
    }
    if (texts.length > 0) return texts.join(' ');
  } catch {
    // Not JSON, try XML
  }

  // Try XML (some timedtext responses come as XML)
  const textMatch = raw.match(/<text[^>]*>(.*?)<\/text>/gs);
  if (textMatch) {
    return textMatch
      .map((t) => t.replace(/<[^>]+>/g, '').trim())
      .join(' ');
  }

  // If nothing parsed, return raw stripped of tags
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Download the YouTube auto-generated English captions and return as plain text.
 * Returns null if no captions are available.
 */
async function fetchYouTubeTranscript(videoId: string): Promise<string | null> {
  const tracks = await extractCaptionTracks(videoId);
  if (!tracks.length) return null;

  // Prefer English tracks (manually created first, then auto-generated)
  // YouTube marks auto-generated captions with vssId containing "a." prefix
  const manualEn = tracks.find(
    (t) => t.languageCode === 'en' && t.vssId && !t.vssId.startsWith('a.'),
  );
  const autoEn = tracks.find(
    (t) => t.languageCode === 'en' || t.languageCode?.startsWith('en'),
  );
  const anyTrack = tracks[0];

  const chosenTrack = manualEn || autoEn || anyTrack;

  try {
    return await fetchAndParseVTT(chosenTrack.baseUrl);
  } catch (err: any) {
    console.warn(`[kb-enrich] Failed to parse captions for ${videoId}:`, err.message);
    return null;
  }
}

// ─── Deepgram transcription (serverless-skipped) ──────────────────────────────

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

/**
 * Transcribe audio bytes via Deepgram Nova 3.
 * Only callable when DEEPGRAM_API_KEY is set.
 */
async function transcribeAudio(audioBuffer: Uint8Array, mimeType = 'audio/mpeg'): Promise<string> {
  if (!DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY not configured');
  }

  const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true', {
    method: 'POST',
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
      'Content-Type': mimeType,
    },
    body: audioBuffer as unknown as BodyInit,
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Deepgram API ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data: any = await res.json();
  return data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
}

// ─── LLM summarization ────────────────────────────────────────────────────────

const SUMMARIZE_PROMPT = `You are summarizing a transcript from a video/podcast for a knowledge base. 
Given the transcript below, produce:
1. A 3-4 sentence summary of the key points
2. Exactly 3 specific learning points (one sentence each)
3. 3-5 relevant tags

Return ONLY valid JSON: {"summary":"...","learning_points":["...","...","..."],"tags":["...","..."]}

Transcript (first 15000 chars):
`;

interface SummarizationOutput {
  summary: string;
  learning_points: string[];
  tags: string[];
}

async function summarizeTranscript(transcript: string): Promise<SummarizationOutput | null> {
  const truncated = transcript.slice(0, 15000);
  const prompt = SUMMARIZE_PROMPT + truncated;

  try {
    const { message } = await llmChat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1000,
      temperature: 0.4,
      timeoutMs: 25000,
    });

    const raw = (message.content ?? '')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.summary !== 'string' ||
      !Array.isArray(parsed.learning_points)
    ) {
      console.warn('[kb-enrich] LLM returned invalid summary format');
      return null;
    }

    return {
      summary: String(parsed.summary),
      learning_points: parsed.learning_points.map(String),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    };
  } catch (err: any) {
    console.warn('[kb-enrich] Summarization failed:', err.message);
    return null;
  }
}

// ─── Upsert ────────────────────────────────────────────────────────────────────

async function upsertEnrichment(
  articleId: number,
  title: string,
  enrichment: SummarizationOutput,
): Promise<void> {
  await sql`
    UPDATE kb_articles
    SET
      summary = ${enrichment.summary},
      learning_points = ${enrichment.learning_points},
      tags = ${enrichment.tags},
      synced_at = NOW()
    WHERE id = ${articleId}
  `;
}

// ─── Enrich single article by URL ─────────────────────────────────────────────

export async function enrichArticleByUrl(url: string): Promise<EnrichResult> {
  // Look up the article by URL
  const rows = await sql`
    SELECT id, title, url FROM kb_articles WHERE url = ${url} LIMIT 1
  `;
  const article = rows[0] as any;
  if (!article) {
    return {
      articleId: 0,
      title: 'unknown',
      url,
      status: 'error',
      error: 'Article not found in kb_articles',
    };
  }

  return enrichArticle(article.id, article.title, article.url ?? url);
}

// ─── Enrich a single article ───────────────────────────────────────────────────

async function enrichArticle(
  id: number,
  title: string,
  url: string,
): Promise<EnrichResult> {
  if (!isMediaUrl(url)) {
    return { articleId: id, title, url, status: 'skipped_no_url' };
  }

  let transcript: string | null = null;

  // ── YouTube: extract captions via HTTP (works in serverless) ──────────────
  if (isYouTubeUrl(url)) {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return {
        articleId: id,
        title,
        url,
        status: 'error',
        error: 'Could not extract YouTube video ID',
      };
    }

    try {
      transcript = await fetchYouTubeTranscript(videoId);
    } catch (err: any) {
      console.warn(`[kb-enrich] YouTube transcript fetch failed for ${videoId}:`, err.message);
    }

    if (!transcript) {
      return { articleId: id, title, url, status: 'skipped_captions' };
    }
  } else {
    // ── Audio-only (podcasts, Spotify): needs yt-dlp + Deepgram ─────────────
    // yt-dlp and audio downloads are not available in Vercel serverless.
    // Skip with a warning but note that DEEPGRAM_API_KEY is needed regardless.
    if (!DEEPGRAM_API_KEY) {
      console.warn(`[kb-enrich] Skipping "${title}" — audio enrichment requires DEEPGRAM_API_KEY + yt-dlp (not available in serverless)`);
      return { articleId: id, title, url, status: 'skipped_audio' };
    }
    console.warn(`[kb-enrich] Skipping "${title}" — audio download (yt-dlp) not available in Vercel serverless`);
    return { articleId: id, title, url, status: 'skipped_audio' };
  }

  // ── Summarize via LLM ─────────────────────────────────────────────────────
  const enrichment = await summarizeTranscript(transcript);
  if (!enrichment) {
    return {
      articleId: id,
      title,
      url,
      status: 'error',
      error: 'LLM summarization failed',
    };
  }

  // ── Upsert ────────────────────────────────────────────────────────────────
  try {
    await upsertEnrichment(id, title, enrichment);
    console.log(`[kb-enrich] Enriched: "${title}"`);
    return { articleId: id, title, url, status: 'enriched' };
  } catch (err: any) {
    return {
      articleId: id,
      title,
      url,
      status: 'error',
      error: `Upsert failed: ${err.message}`,
    };
  }
}

// ─── Batch enrichment ─────────────────────────────────────────────────────────

/**
 * Find all kb_articles that have a media URL but no summary, and enrich them
 * one by one. Returns a summary of what happened.
 */
export async function enrichPendingMediaArticles(): Promise<EnrichSummary> {
  const errors: string[] = [];
  let rows: any[] = [];

  try {
    // Query articles where summary is NULL and URL looks like media content
    rows = await sql`
      SELECT id, title, url FROM kb_articles
      WHERE summary IS NULL
        AND url IS NOT NULL
        AND url != ''
      ORDER BY id
      LIMIT 20
    `;
  } catch (err: any) {
    errors.push(`query: ${err.message}`);
    return { ok: false, enriched: [], errors, timestamp: new Date().toISOString() };
  }

  if (!rows.length) {
    return { ok: true, enriched: [], errors, timestamp: new Date().toISOString() };
  }

  // Filter to media URLs only (the DB query is broad; we tighten in-app)
  const mediaArticles = rows.filter((r: any) => isMediaUrl(r.url));

  const results: EnrichResult[] = [];

  for (const article of mediaArticles) {
    try {
      const result = await enrichArticle(article.id, article.title, article.url!);
      results.push(result);
    } catch (err: any) {
      results.push({
        articleId: article.id,
        title: article.title,
        url: article.url!,
        status: 'error',
        error: err.message,
      });
    }
  }

  const enriched = results.filter((r) => r.status === 'enriched');
  const resultErrors = results.filter((r) => r.status === 'error');

  console.log(
    `[kb-enrich] Processed ${results.length} articles: ` +
    `${enriched.length} enriched, ${results.length - enriched.length - resultErrors.length} skipped, ` +
    `${resultErrors.length} errors`,
  );

  return {
    ok: true,
    enriched: results,
    errors: [...errors, ...resultErrors.map((r) => r.error!).filter(Boolean)],
    timestamp: new Date().toISOString(),
  };
}