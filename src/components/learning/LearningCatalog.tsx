'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CuratedLearningModule } from '@/lib/safety-curriculum';

const TOPICS = [
  ['all', 'All topics'], ['bitcoin', 'Bitcoin'], ['ethereum', 'Ethereum'],
  ['decentralization', 'Decentralization'], ['ai', 'AI & agents'],
  ['creator', 'Creator economy'], ['dao', 'DAOs'], ['privacy', 'Privacy'],
  ['bankless', 'Bankless'], ['network-states', 'Network states'], ['security', 'Safety'],
] as const;

export default function LearningCatalog({ modules }: { modules: CuratedLearningModule[] }) {
  const [topic, setTopic] = useState('all');
  const [level, setLevel] = useState('all');
  const visible = modules.filter(module => (topic === 'all' || module.tags.includes(topic)) && (level === 'all' || module.difficulty === level));
  return (
    <section className="mt-10" aria-labelledby="catalog-heading">
      <h2 id="catalog-heading" className="text-2xl font-bold">Choose your next question</h2>
      <div className="mt-5 flex flex-wrap gap-2" aria-label="Course topics">
        {TOPICS.map(([id, label]) => <button key={id} type="button" aria-pressed={topic === id} onClick={() => setTopic(id)}
          className={`rounded-full border px-4 py-2 text-sm ${topic === id ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] text-[var(--text-on-dark)]'}`}>{label}</button>)}
      </div>
      <label className="mt-5 flex items-center gap-3 text-sm">Difficulty
        <select value={level} onChange={event => setLevel(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text-on-dark)]">
          <option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
        </select>
      </label>
      <p className="mt-4 text-sm text-[var(--muted-on-dark)]" role="status">{visible.length} courses</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(module => <Link key={module.id} href={`/learn/library/${module.id}`} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 no-underline transition hover:border-[var(--accent)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-on-dark)]">{module.difficulty} · {module.estimatedMinutes} min</p>
          <h3 className="mt-4 text-xl font-bold text-[var(--text-on-dark)] group-hover:text-[var(--accent)]">{module.title}</h3>
          <p className="mt-3 leading-7 text-[var(--muted-on-dark)]">{module.description}</p>
          <p className="mt-5 text-sm font-semibold text-[var(--accent)]">Read lesson →</p>
        </Link>)}
      </div>
      {visible.length === 0 && <p className="mt-5">No courses match both filters. Choose another topic or difficulty.</p>}
    </section>
  );
}
