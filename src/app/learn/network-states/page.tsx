import type { Metadata } from 'next';
import Link from 'next/link';
import { NETWORK_STATE_CURRICULUM } from '@/lib/network-state-curriculum';
import StartNetworkStateCourse from '@/components/learning/StartNetworkStateCourse';

export const metadata: Metadata = {
  title: 'Network States: Proposal, Counterpoints, and Alternatives',
  description: 'Four free courses comparing Balaji’s Network State proposal with constructive criticism, commons-based perspectives, and participatory governance.',
  alternates: { canonical: '/learn/network-states' },
};

export default function NetworkStateCoursesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <Link href="/learn" className="text-[var(--accent)]">← Learning Hub</Link>
      <header className="mt-6 max-w-3xl">
        <p className="text-sm font-semibold text-[var(--accent)]">Free courses · Beginner to advanced</p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Network States: examine the idea.</h1>
        <p className="mt-5 text-lg leading-8 text-[var(--muted-on-dark)]">Understand Balaji’s proposal, consider substantive objections, and compare alternatives. Each course includes the proposal and counterpoints, linked readings, a fictional exercise, and a quiz. You are assessed on understanding, not agreement.</p>
        <p className="mt-4 text-sm leading-7 text-[var(--muted-on-dark)]">Read without an account. Interactive courses use your existing lesson player and completion flow. Starting a course makes this series your active learning plan and keeps your completion records.</p>
      </header>
      <section aria-label="Network State courses" className="mt-10 grid gap-5 md:grid-cols-2">
        {NETWORK_STATE_CURRICULUM.map(({ module }, index) => (
          <article key={module.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-sm text-[var(--muted-on-dark)]">Course {index + 1} · {module.difficulty} · {module.estimatedMinutes} min</p>
            <h2 className="mt-3 text-2xl font-bold">{module.title}</h2>
            <p className="mt-3 leading-7 text-[var(--muted-on-dark)]">{module.description}</p>
            <Link href={`/learn/library/${module.id}`} className="my-5 block text-[var(--accent)] underline">Read course and sources →</Link>
            <StartNetworkStateCourse moduleId={module.id} />
          </article>
        ))}
      </section>
      <aside className="mt-8 text-sm leading-7 text-[var(--muted-on-dark)]">The shorter Balaji readings overlap the book and are not independent confirmation. The critical podcast source is summarized from its written introduction; audio was not reviewed. Modular Politics is an earlier alternative framework, not a direct rebuttal or proof of results.</aside>
    </main>
  );
}
