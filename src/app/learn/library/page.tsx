import type { Metadata } from 'next';
import Link from 'next/link';
import { SAFETY_CURRICULUM } from '@/lib/safety-curriculum';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export const metadata: Metadata = {
  title: 'Crypto Safety Library',
  description: 'Free, practical lessons on wallet safety, scam defense, transaction approvals, risk budgets, and DeFi due diligence.',
  alternates: { canonical: '/learn/library' },
  openGraph: {
    title: 'Crypto Safety Library | HomieHouse',
    description: 'Learn how to participate in crypto without letting one mistake knock you out of the ecosystem.',
    url: `${BASE_URL}/learn/library`,
    images: [`${BASE_URL}/api/og/content?kind=learning%20library&title=Stay%20in%20the%20Game&description=Practical%20crypto%20safety%2C%20without%20the%20hype.`],
  },
  other: {
    'fc:miniapp': JSON.stringify({
      version: '1',
      imageUrl: `${BASE_URL}/api/og/content?kind=learning%20library&title=Stay%20in%20the%20Game&description=Practical%20crypto%20safety%2C%20without%20the%20hype.`,
      button: { title: 'Start learning', action: { type: 'launch_miniapp', name: 'HomieHouse', url: `${BASE_URL}/learn/library` } },
    }),
    'fc:frame': JSON.stringify({
      version: '1',
      imageUrl: `${BASE_URL}/api/og/content?kind=learning%20library&title=Stay%20in%20the%20Game&description=Practical%20crypto%20safety%2C%20without%20the%20hype.`,
      button: { title: 'Start learning', action: { type: 'launch_frame', name: 'HomieHouse', url: `${BASE_URL}/learn/library` } },
    }),
  },
};

export default function LearningLibraryPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'HomieHouse Crypto Safety Library',
    url: `${BASE_URL}/learn/library`,
    description: metadata.description,
    hasPart: SAFETY_CURRICULUM.map(({ module }) => ({
      '@type': 'LearningResource',
      name: module.title,
      url: `${BASE_URL}/learn/library/${module.id}`,
      educationalLevel: module.difficulty,
      timeRequired: `PT${module.estimatedMinutes}M`,
    })),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Free safety curriculum</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Stay in the game.</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--muted-on-dark)]">
          Learn how wallets, signatures, scams, position sizing, and DeFi risk actually work. No price calls. No guaranteed returns. No wallet connection required to read.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/learn?track=survival" className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white no-underline">Start the interactive track</Link>
          <Link href="/community" className="rounded-xl border border-[var(--border)] px-5 py-3 font-semibold text-[var(--text-on-dark)] no-underline">Meet the community idea</Link>
        </div>
      </header>

      <section className="mt-12 grid gap-4 md:grid-cols-2" aria-label="Safety lessons">
        {SAFETY_CURRICULUM.map(({ module }, index) => (
          <Link key={module.id} href={`/learn/library/${module.id}`} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 no-underline transition hover:border-[var(--accent)]">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-wider text-[var(--muted-on-dark)]">
              <span>Lesson {index + 1}</span>
              <span>{module.estimatedMinutes} min</span>
            </div>
            <h2 className="mt-4 text-xl font-bold text-[var(--text-on-dark)] group-hover:text-[var(--accent)]">{module.title}</h2>
            <p className="mt-3 leading-7 text-[var(--muted-on-dark)]">{module.description}</p>
            <p className="mt-5 text-sm font-semibold text-[var(--accent)]">Read lesson →</p>
          </Link>
        ))}
      </section>

      <aside className="mt-10 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm leading-6 text-[var(--muted-on-dark)]">
        HomieHouse provides education, not individualized financial, tax, or legal advice. Crypto assets and protocols can lose value or fail; never risk money needed for essential expenses.
      </aside>
    </main>
  );
}
