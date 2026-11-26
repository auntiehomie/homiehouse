import Link from 'next/link';
import type { Metadata } from 'next';
import { CASTBOARDS } from '@/lib/castboards';
export const metadata: Metadata = { title: 'Castboards | HomieHouse', description: 'Curated topics from Farcaster channels. Find your next conversation.' };
export default function CastboardsPage() {
  return <main className="max-w-3xl mx-auto px-4 py-8 pb-24">
    <Link href="/feed">← Feed</Link>
    <h1 className="text-2xl font-bold mt-4">Topic castboards</h1>
    <p className="my-4">Curated channel collections, fresh conversations. No account required.</p>
    <div className="grid sm:grid-cols-2 gap-4">{CASTBOARDS.map(board => <Link key={board.slug} href={`/castboards/${board.slug}`} className="surface block p-5 rounded-xl">
      <h2 className="text-lg font-bold">{board.title}</h2><p className="my-2">{board.description}</p>
      <p className="text-sm" style={{ color: 'var(--muted-on-dark)' }}>{board.channels.map(id => `/${id}`).join(' · ')}</p>
    </Link>)}</div>
    <p className="mt-6 text-sm">Topics are curated channel bundles, not keyword classifications. <Link href="/channels" className="underline">Browse all channels</Link>.</p>
  </main>;
}
