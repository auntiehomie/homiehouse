'use client';

import Link from 'next/link';

export interface CourseCatalogItem {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  section?: 'safety' | 'network' | 'premium';
  href?: string;
}

export type CatalogTrack = 'ai' | 'finance' | 'creator' | 'decentralization' | 'all';
export type CatalogLevel = 'beginner' | 'intermediate' | 'advanced';

const TRACKS: Array<{ id: CatalogTrack; icon: string; title: string; summary: string }> = [
  { id: 'ai', icon: '🤖', title: 'AI', summary: 'AI agents, language models, and the AI–crypto frontier.' },
  { id: 'finance', icon: '💰', title: 'Finance and DeFi', summary: 'Tokens, decentralized finance, and on-chain systems.' },
  { id: 'creator', icon: '🛠️', title: 'Creator Economy', summary: 'Zora, creator coins, and sustainable ways to build.' },
  { id: 'decentralization', icon: '🌐', title: 'Decentralization', summary: 'Blockchains, wallets, governance, and decentralized social.' },
  { id: 'all', icon: '✨', title: 'All topics', summary: 'Connect the ideas across the whole ecosystem.' },
];

const LEVELS: CatalogLevel[] = ['beginner', 'intermediate', 'advanced'];

export default function CourseCatalog({
  courses,
  onSelectPath,
}: {
  courses: CourseCatalogItem[];
  onSelectPath?: (track: CatalogTrack, level: CatalogLevel) => void;
}) {
  const safetyCourses = courses.filter(course => (course.section ?? (course.tags.includes('network-states') ? 'network' : 'safety')) === 'safety');
  const networkCourses = courses.filter(course => (course.section ?? (course.tags.includes('network-states') ? 'network' : 'safety')) === 'network');
  const premiumCourses = courses.filter(course => course.section === 'premium');

  const renderCourses = (title: string, items: CourseCatalogItem[]) => (
    <section aria-label={title} className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-on-dark)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted-on-dark)]">{items.length} courses · start any course on its own</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(course => (
          <Link
            key={course.id}
            href={course.href ?? `/learn/library/${course.id}`}
            className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 no-underline transition hover:border-[var(--accent)]"
          >
            <div className="flex items-center justify-between gap-3 text-xs capitalize text-[var(--muted-on-dark)]">
              <span>{course.difficulty}</span>
              <span>{course.estimatedMinutes} min</span>
            </div>
            <h3 className="mt-3 font-bold leading-snug text-[var(--text-on-dark)] group-hover:text-[var(--accent)]">{course.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-on-dark)]">{course.description}</p>
            <span className="mt-4 block text-sm font-semibold text-[var(--accent)]">Open course →</span>
          </Link>
        ))}
      </div>
    </section>
  );

  return (
    <div className="hh-learn-panel mx-auto w-full px-4 py-6 sm:px-6">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Homiehouse Learning Hub</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--text-on-dark)] sm:text-4xl">Course Catalog</h1>
        <p className="mt-3 leading-7 text-[var(--muted-on-dark)]">Choose a standalone course, or build an interactive path at the level that fits you.</p>
      </header>

      <section aria-labelledby="interactive-paths-heading" className="mt-8">
        <div className="mb-4">
          <h2 id="interactive-paths-heading" className="text-xl font-bold text-[var(--text-on-dark)]">Interactive paths</h2>
          <p className="mt-1 text-sm text-[var(--muted-on-dark)]">Pick a topic and level. You can personalize the path before starting.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {TRACKS.map(track => (
            <article key={track.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex gap-3">
                <span aria-hidden="true" className="text-2xl">{track.icon}</span>
                <div>
                  <h3 className="font-bold text-[var(--text-on-dark)]">{track.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-[var(--muted-on-dark)]">{track.summary}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2" aria-label={`${track.title} learning levels`}>
                {LEVELS.map(level => onSelectPath ? (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onSelectPath(track.id, level)}
                    className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold capitalize text-[var(--text-on-dark)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {level}
                  </button>
                ) : (
                  <Link
                    key={level}
                    href={`/learn?tab=plan&start=path&track=${track.id}&level=${level}`}
                    className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-semibold capitalize text-[var(--text-on-dark)] no-underline transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {level}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {renderCourses('Crypto safety', safetyCourses)}
      {renderCourses('Network States: proposal and counterpoints', networkCourses)}
      {renderCourses('Premium courses', premiumCourses)}
    </div>
  );
}
