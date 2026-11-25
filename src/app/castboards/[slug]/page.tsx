import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getCastboard } from '@/lib/castboards';
import CastboardFeed from '@/components/CastboardFeed';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const board = getCastboard((await params).slug);
  return { title: `${board?.title || 'Castboard'} | HomieHouse`, description: board?.description };
}
export default async function CastboardPage({ params }: Props) {
  const board = getCastboard((await params).slug);
  if (!board) notFound();
  return <main className="max-w-3xl mx-auto px-4 py-8 pb-24">
    <Link href="/castboards">← All castboards</Link>
    <h1 className="text-2xl font-bold mt-4">{board.title}</h1><p className="my-3">{board.description}</p>
    <div className="flex gap-3 flex-wrap">{board.channels.map(id => <Link className="btn" key={id} href={`/channel/${id}`}>/{id} ↗</Link>)}</div>
    <p className="text-sm my-4" style={{ color: 'var(--muted-on-dark)' }}>Recent sample: up to 25 casts per channel, deduplicated and newest first. Open a channel for its full paginated feed.</p>
    <CastboardFeed key={board.slug} slug={board.slug} />
  </main>;
}
