'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthHeaders } from '@/lib/client-auth';
import type { LessonModuleRequest } from '@/lib/lesson-client-cache';

export default function StartNetworkStateCourse({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getAuthHeaders() ?? {}) },
        body: JSON.stringify({ track: 'network-states', level: 'beginner' }),
        signal: AbortSignal.timeout(20000),
      });
      const plan = await response.json();
      if (!response.ok || !Array.isArray(plan.modules) || !plan.modules.some((module: LessonModuleRequest) => module.id === moduleId)) {
        throw new Error(plan.error || 'Could not open this course. Please try again.');
      }
      // Preserve progress/completion records; only the active plan changes.
      localStorage.setItem('hh_learning_plan', JSON.stringify(plan));
      router.push(`/learn/module?id=${encodeURIComponent(moduleId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open this course. Please try again.');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void start()} disabled={loading} aria-busy={loading}
        className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-60">
        {loading ? 'Opening course…' : 'Take the interactive course'}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
