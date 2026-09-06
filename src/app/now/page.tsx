import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Now | HomieHouse',
  description: 'What HomieHouse is working on now: current projects, learning focus, and goals.',
  openGraph: {
    title: 'Now | HomieHouse',
    description: 'A short, living snapshot of what is happening at HomieHouse.',
  },
};

const sections = [
  {
    title: 'Current projects',
    items: [
      'Making HomieHouse a warmer home for learning in public.',
      'Improving the Farcaster feed, curated lists, and saved casts experience.',
      'Building small AI helpers that turn curiosity into useful next steps.',
    ],
  },
  {
    title: 'Learning focus',
    items: [
      'Decentralized identity and social protocols.',
      'Thoughtful, practical AI agents for everyday knowledge work.',
      'Designing calmer interfaces for complex tools and communities.',
    ],
  },
  {
    title: 'Goals',
    items: [
      'Ship small improvements regularly and learn from real use.',
      'Keep the open web approachable, useful, and a little more human.',
      'Make room for experiments, good questions, and generous collaboration.',
    ],
  },
];

export default function NowPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-10 max-w-2xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent-soft)]">A living snapshot</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">What I&apos;m working on now</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--muted-on-dark)]">
          A small, honest view of the ideas and projects getting attention at HomieHouse.
        </p>
      </header>
      <div className="grid gap-5 md:grid-cols-3">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <ul className="mt-5 space-y-4 text-sm leading-6 text-[var(--muted-on-dark)]">
              {section.items.map((item) => <li key={item} className="before:mr-2 before:text-[var(--accent)] before:content-['•']">{item}</li>)}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-[var(--muted-on-dark)]">This page changes as the work changes. Last updated September 2026.</p>
    </main>
  );
}
