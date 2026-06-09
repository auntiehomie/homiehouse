import { NextRequest, NextResponse } from 'next/server';
import { createApiLogger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/ratelimit';
import dns from 'dns/promises';

export const maxDuration = 30;

function isPrivateIP(ip: string): boolean {
  if (ip === '::1' || ip === '::') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const [a, b] = parts;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || a === 127 || (a === 169 && b === 254) || a === 0;
}

async function checkHost(hostname: string) {
  if (isPrivateIP(hostname)) throw new Error('Private IP blocked');
  try {
    const addrs = await dns.resolve4(hostname);
    if (addrs.some(isPrivateIP)) throw new Error('Private IP blocked');
  } catch (e: any) {
    if (e.message === 'Private IP blocked') throw e;
  }
}

function extractContent(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch?.[1] ?? '';

  // Remove noisy blocks
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Newlines for block elements
  body = body
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ');

  // Strip tags + decode entities
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const title = rawTitle
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim();

  return { title, text: text.slice(0, 10000) };
}

async function summarizeWithAI(url: string, title: string, text: string, urlOnly = false): Promise<string> {
  const prompt = urlOnly
    ? `You are Homie, an AI assistant inside HomieHouse — a social learning platform for Web3, DeFi, and crypto.

A user shared this link but the page could not be fetched (it may be paywalled or block automated access):
URL: ${url}
${title ? `Title (from metadata): ${title}` : ''}

Based solely on what you know about this URL, domain, and topic, provide what you can:

**What This Likely Covers**
2-3 sentences about what this article/page is probably about based on the URL and your training knowledge.

**Key Context**
3-5 bullet points of relevant background knowledge on this topic you can share.

**Why It Matters for Web3/DeFi Learners**
2-3 sentences connecting this topic to the decentralized finance or crypto landscape.

**Explore Further**
2 follow-up questions the user could ask Homie to go deeper.

Be honest that you couldn't read the actual article — only share what you genuinely know. Don't fabricate article-specific facts.`
    : `You are Homie, an AI assistant inside HomieHouse — a social learning platform for Web3, DeFi, and crypto.

A user shared this article:
URL: ${url}
Title: ${title}

Article content (extracted):
${text.slice(0, 6000)}

Provide a structured summary:

**TL;DR**
2-3 clear sentences on what this article is about.

**Key Points**
3-5 bullet points of the most important takeaways.

**Why It Matters for Web3/DeFi Learners**
2-3 sentences connecting this to the decentralized finance or crypto landscape.

**Explore Further**
2 follow-up questions the user could ask Homie to go deeper.

Keep it concise, accurate, and educational. Don't add opinions — stick to what the article says.`;

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.content?.[0]?.text || '';
    }
  }

  throw new Error('No AI provider configured');
}

export async function POST(req: NextRequest) {
  const logger = createApiLogger('/summarize-url');
  logger.start();

  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const { success } = rateLimit(`summarize-url:${ip}`, 15, 3600);
    if (!success) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Only HTTP/HTTPS URLs supported' }, { status: 400 });
    }

    try {
      await checkHost(parsed.hostname);
    } catch {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }

    logger.info('Fetching URL', { url });

    // Strategy 1: direct fetch with a realistic browser UA
    let pageTitle = '';
    let pageText = '';
    let fetchOk = false;

    try {
      const directRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });

      if (directRes.ok) {
        const ct = directRes.headers.get('content-type') || '';
        if (ct.includes('html') || ct.includes('text')) {
          const buf = await directRes.arrayBuffer();
          const html = new TextDecoder().decode(buf.slice(0, 1_500_000));
          const extracted = extractContent(html);
          if (extracted.text.length >= 80) {
            pageTitle = extracted.title;
            pageText = extracted.text;
            fetchOk = true;
          }
        }
      }
    } catch (_) {}

    // Strategy 2: Jina AI Reader — converts any URL to clean AI-readable text,
    // bypasses paywalls and bot-detection that block direct server fetches.
    if (!fetchOk) {
      logger.info('Direct fetch failed, trying Jina Reader', { url });
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
          headers: {
            'Accept': 'text/plain, text/markdown',
            'X-Return-Format': 'markdown',
          },
          signal: AbortSignal.timeout(20000),
        });
        if (jinaRes.ok) {
          const md = await jinaRes.text();
          if (md.length >= 80) {
            // Jina prepends "Title: ..." and "URL Source: ..." — extract them
            const titleLine = md.match(/^Title:\s*(.+)/m);
            pageTitle = titleLine?.[1]?.trim() ?? '';
            pageText = md.slice(0, 10000);
            fetchOk = true;
          }
        }
      } catch (_) {}
    }

    // Strategy 3: page unreadable — use AI knowledge about the URL itself
    if (!fetchOk) {
      logger.info('Both fetch strategies failed, using AI knowledge fallback', { url });
      try {
        const summary = await summarizeWithAI(url, pageTitle, '', true);
        logger.success('AI knowledge fallback succeeded', { url });
        logger.end();
        return NextResponse.json({ summary, title: pageTitle, url, fetchFallback: true });
      } catch (_) {
        return NextResponse.json(
          { error: 'Could not read this page. It may be paywalled, require login, or block automated access.' },
          { status: 422 }
        );
      }
    }

    logger.info('Summarizing', { titleLen: pageTitle.length, textLen: pageText.length });
    const summary = await summarizeWithAI(url, pageTitle, pageText);

    logger.success('Summarized', { url });
    logger.end();
    return NextResponse.json({ summary, title: pageTitle, url });
  } catch (err: any) {
    logger.error('summarize-url failed', err);
    if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      return NextResponse.json({ error: 'Page took too long to load' }, { status: 408 });
    }
    return handleApiError(err, 'POST /summarize-url');
  }
}
