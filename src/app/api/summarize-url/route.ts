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

async function summarizeWithAI(url: string, title: string, text: string): Promise<string> {
  const prompt = `You are Homie, an AI assistant inside HomieHouse — a social learning platform for Web3, DeFi, and crypto.

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

    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomieHouse/1.0; +https://homiehouse.lol)',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!fetchRes.ok) {
      return NextResponse.json({ error: `Could not fetch page (HTTP ${fetchRes.status})` }, { status: 422 });
    }

    const ct = fetchRes.headers.get('content-type') || '';
    if (!ct.includes('html') && !ct.includes('text')) {
      return NextResponse.json({ error: 'URL does not point to a readable page' }, { status: 422 });
    }

    const buf = await fetchRes.arrayBuffer();
    const html = new TextDecoder().decode(buf.slice(0, 1_500_000));
    const { title, text } = extractContent(html);

    if (text.length < 80) {
      return NextResponse.json({ error: 'Could not extract readable content from this page' }, { status: 422 });
    }

    logger.info('Summarizing', { titleLen: title.length, textLen: text.length });
    const summary = await summarizeWithAI(url, title, text);

    logger.success('Summarized', { url });
    logger.end();
    return NextResponse.json({ summary, title, url });
  } catch (err: any) {
    logger.error('summarize-url failed', err);
    if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      return NextResponse.json({ error: 'Page took too long to load' }, { status: 408 });
    }
    return handleApiError(err, 'POST /summarize-url');
  }
}
