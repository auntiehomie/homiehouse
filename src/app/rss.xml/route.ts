import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';
const posts = [
  { title: 'Welcome to HomieHouse', description: 'A cozy home for learning Web3, connecting on Farcaster, and making sense of the decentralized web.', path: '/now', date: '2026-09-09' },
];
const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '\"': '&quot;' })[char] || char);

export function GET() {
  const items = posts.map((post) => `\n    <item>\n      <title>${escapeXml(post.title)}</title>\n      <link>${BASE_URL}${post.path}</link>\n      <guid isPermaLink="true">${BASE_URL}${post.path}</guid>\n      <description>${escapeXml(post.description)}</description>\n      <pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>\n    </item>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>HomieHouse</title><link>${BASE_URL}</link><description>Learning Web3 and building a more human open web.</description><language>en-us</language>${items}\n  </channel></rss>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
