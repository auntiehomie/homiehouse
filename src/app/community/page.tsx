import type { Metadata } from 'next';
import Link from 'next/link';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homiehouse.lol';

export const metadata: Metadata = {
  title: 'Community',
  description: 'A safety-first crypto learning community: learn in public, practice with small stakes, and help each other spot risk before it becomes a loss.',
  alternates: { canonical: '/community' },
  openGraph: {
    title: 'Stay in the Game | HomieHouse Community',
    description: 'Learn crypto together without the hype, shame, or pressure to gamble.',
    url: `${BASE_URL}/community`,
    images: [`${BASE_URL}/api/og/content?kind=community&title=Stay%20in%20the%20Game&description=Learn%20crypto%20together%20without%20the%20hype.`],
  },
  other: {
    'fc:miniapp': JSON.stringify({
      version: '1',
      imageUrl: `${BASE_URL}/api/og/content?kind=community&title=Stay%20in%20the%20Game&description=Learn%20crypto%20together%20without%20the%20hype.`,
      button: { title: 'Join the learning loop', action: { type: 'launch_miniapp', name: 'HomieHouse', url: `${BASE_URL}/community` } },
    }),
    'fc:frame': JSON.stringify({
      version: '1',
      imageUrl: `${BASE_URL}/api/og/content?kind=community&title=Stay%20in%20the%20Game&description=Learn%20crypto%20together%20without%20the%20hype.`,
      button: { title: 'Join the learning loop', action: { type: 'launch_frame', name: 'HomieHouse', url: `${BASE_URL}/community` } },
    }),
  },
};

const principles = [
  ['No guaranteed returns', 'We explain risk and tradeoffs. Price predictions are never treated as education.'],
  ['No shame for basic questions', 'A safer ecosystem starts when people can ask before they sign.'],
  ['No secret support', 'Keep help public. Nobody needs your seed phrase, private key, password, or remote access.'],
  ['Small experiments first', 'Practice with amounts you can lose and test the exit before increasing exposure.'],
];

const weeklyLoop = [
  ['Learn', 'Finish one short, source-backed safety lesson.'],
  ['Practice', 'Complete one low-risk action, such as reviewing an approval or mapping a protocol’s controls.'],
  ['Share', 'Post the lesson, the action, and one unanswered question with #HomieHouseLearning.'],
  ['Protect', 'Help another learner slow down and verify—never tell them what to buy.'],
];

export default function CommunityPage() {
  const prompt = `This week I learned:\n\nOne safety habit I practiced:\n\nOne question I still have:\n\n#HomieHouseLearning #StayInTheGame`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">HomieHouse Community</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Learn together. Stay in the game.</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--muted-on-dark)]">
          A community for learning how crypto works—and how to participate without letting hype, scammers, or one oversized bet decide your future.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/learn?track=survival" className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white no-underline">Start Crypto Safety</Link>
          <Link href="/learn/library" className="rounded-xl border border-[var(--border)] px-5 py-3 font-semibold text-[var(--text-on-dark)] no-underline">Browse free lessons</Link>
        </div>
      </header>

      <section className="mt-14">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">The community pledge</p>
        <h2 className="mt-3 text-3xl font-bold">Safety is a practice, not a disclaimer.</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {principles.map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="mt-3 leading-7 text-[var(--muted-on-dark)]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">A simple weekly rhythm</p>
        <div className="mt-7 grid gap-6 md:grid-cols-4">
          {weeklyLoop.map(([title, body], index) => (
            <div key={title}>
              <span className="text-sm font-bold text-[var(--accent)]">0{index + 1}</span>
              <h3 className="mt-2 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-on-dark)]">{body}</p>
            </div>
          ))}
        </div>
        <Link href={`/compose?text=${encodeURIComponent(prompt)}`} className="mt-8 inline-flex rounded-xl border border-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent)] no-underline">Share this week’s learning check-in</Link>
      </section>

      <section className="mt-14 grid gap-5 md:grid-cols-3">
        <div className="md:col-span-2">
          <h2 className="text-3xl font-bold">What we build next</h2>
          <p className="mt-4 max-w-2xl leading-8 text-[var(--muted-on-dark)]">
            This first release establishes the curriculum, shared norms, and public learning loop. The next community layer should grow from real behavior: moderated study circles, member-submitted scam breakdowns with private information removed, and a searchable library of “what went wrong” case studies.
          </p>
        </div>
        <aside className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm leading-6 text-[var(--muted-on-dark)]">
          HomieHouse will never ask for a seed phrase or private key. Community posts are education and personal experience—not individualized financial advice or endorsements.
        </aside>
      </section>
    </main>
  );
}
