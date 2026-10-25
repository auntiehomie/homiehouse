import type { Metadata } from 'next';
import Link from 'next/link';
import LearningCatalog from '@/components/learning/LearningCatalog';
import { CURATED_MODULES } from '@/lib/curated-curriculum';
import { CURATED_CURRICULUM } from '@/lib/curated-curriculum';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export const metadata: Metadata = {
  title: 'Learning Library',
  description: 'Source-linked courses on Bitcoin, Ethereum, AI, creator economies, DAOs, privacy, safety, and governance.',
  alternates: { canonical: '/learn/library' },
  openGraph: {
    title: 'Learning Library | HomieHouse',
    description: 'Explore the ideas in your feed through source-linked lessons, practical exercises, and critical questions.',
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
    name: 'HomieHouse Learning Library',
    url: `${BASE_URL}/learn/library`,
    description: metadata.description,
    hasPart: CURATED_CURRICULUM.map(({ module }) => ({
      '@type': 'LearningResource',
      name: module.title,
      url: `${BASE_URL}/learn/library/${module.id}`,
      educationalLevel: module.difficulty,
      timeRequired: `PT${module.estimatedMinutes}M`,
    })),
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Ideas worth understanding</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Follow your curiosity.</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--muted-on-dark)]">
          Explore Bitcoin, Ethereum, decentralization, AI agents, creator economies, DAOs, and privacy. Read original arguments alongside limitations and critical questions. No wallet connection required to read.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/learn?track=survival" className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white no-underline">Start the interactive track</Link>
          <Link href="/ask-homie" className="rounded-xl border border-[var(--border)] px-5 py-3 font-semibold text-[var(--text-on-dark)] no-underline">Ask Homie about a cast</Link>
        </div>
      </header>

      <section className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6" aria-labelledby="network-state-heading">
        <h2 id="network-state-heading" className="text-2xl font-bold">Network States: proposal and counterpoints</h2>
        <p className="my-4 leading-7 text-[var(--muted-on-dark)]">Four courses on the proposal, founder power, inclusion, and alternatives. Read sources from supporters and critics, then test your understanding.</p>
        <Link href="/learn/network-states" className="text-[var(--accent)] underline">Explore the four courses →</Link>
      </section>

      <p className="mt-8 leading-7 text-[var(--muted-on-dark)]">Want a lesson from a cast? Ask Homie combines relevant readings and knowledge-base context with AI explanations. Fixed courses are a starting point; cast lessons adapt to your question. Reading notes are dated background, not live verification.</p>

      <LearningCatalog modules={CURATED_MODULES} />

      <aside className="mt-10 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm leading-6 text-[var(--muted-on-dark)]">
        HomieHouse provides education, not individualized financial, tax, or legal advice. Crypto assets and protocols can lose value or fail; never risk money needed for essential expenses.
      </aside>
    </main>
  );
}
