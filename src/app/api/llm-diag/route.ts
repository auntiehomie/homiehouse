import { NextRequest, NextResponse } from 'next/server';
import { getLLMProviders } from '@/lib/llm';

export const maxDuration = 90;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const providers = getLLMProviders();
  const results: Record<string, string> = {
    configured: providers.map(p => p.name).join(',') || 'none',
  };

  for (const p of providers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await p.client.chat.completions.create(
        {
          model: p.model,
          messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
          max_tokens: 10,
        },
        { signal: controller.signal },
      );
      clearTimeout(timer);
      results[p.name] = `OK: ${response.choices[0]?.message?.content?.trim()}`;
    } catch (err: any) {
      clearTimeout(timer);
      results[p.name] = `FAIL: ${err?.message?.slice(0, 200)}`;
    }
  }

  return NextResponse.json(results);
}
