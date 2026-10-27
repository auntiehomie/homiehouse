'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  noteSources,
  reactionSources,
  recentCastSources,
  selectInspirationSources,
  type ComposeInspirationSource,
} from '@/lib/compose-inspiration';
import { getAuthHeaders } from '@/lib/client-auth';
import { loadRecentInteractions } from '@/lib/recent-interactions';

interface ComposeInspirationProps {
  fid: number;
  hasText: boolean;
  onUseDraft: (draft: string) => void;
}

interface NoteRecord {
  updatedAt?: string;
}

function readNotes(): unknown[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('hh_notes') || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...parsed].sort((left, right) => {
      const a = typeof (left as NoteRecord)?.updatedAt === 'string' ? (left as NoteRecord).updatedAt! : '';
      const b = typeof (right as NoteRecord)?.updatedAt === 'string' ? (right as NoteRecord).updatedAt! : '';
      return b.localeCompare(a);
    });
  } catch {
    return [];
  }
}

function sourceIcon(kind: ComposeInspirationSource['kind']): string {
  if (kind === 'note') return '📝';
  if (kind === 'reaction') return '✨';
  return '↗';
}

export default function ComposeInspiration({ fid, hasText, onUseDraft }: ComposeInspirationProps) {
  const [recentCasts, setRecentCasts] = useState<unknown[]>([]);
  const [notes, setNotes] = useState<unknown[]>([]);
  const [loadingCasts, setLoadingCasts] = useState(true);
  const [offset, setOffset] = useState(0);
  const [collapsed, setCollapsed] = useState(hasText);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(readNotes());
  }, []);

  useEffect(() => {
    if (hasText) setCollapsed(true);
  }, [hasText]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingCasts(true);
    fetch(`/api/profile?fid=${fid}&casts=true`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load recent casts');
        return response.json();
      })
      .then((data) => setRecentCasts(Array.isArray(data.casts) ? data.casts : []))
      .catch((cause) => {
        if (cause instanceof Error && cause.name !== 'AbortError') setRecentCasts([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCasts(false);
      });
    return () => controller.abort();
  }, [fid]);

  const sources = useMemo(() => selectInspirationSources([
    recentCastSources(recentCasts),
    noteSources(notes),
    reactionSources(loadRecentInteractions()),
  ], offset), [notes, offset, recentCasts]);

  async function createDrafts(source: ComposeInspirationSource) {
    setActiveSourceId(source.id);
    setDrafts([]);
    setError(null);
    try {
      const authHeaders = getAuthHeaders();
      if (!authHeaders) throw new Error('Enable posting to use personalized drafts.');
      const response = await fetch('/api/compose/suggestions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders },
        body: JSON.stringify({ fid, source }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create drafts');
      setDrafts(Array.isArray(data.drafts) ? data.drafts : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create drafts');
    }
  }

  if (collapsed) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '10px 16px 24px' }}>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', fontSize: 13, cursor: 'pointer', padding: '6px 0' }}
        >
          ✨ Need another angle? Show ideas
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="compose-ideas-title" style={{ maxWidth: 640, margin: '0 auto', padding: '18px 16px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <h2 id="compose-ideas-title" style={{ margin: 0, fontSize: 16, color: 'var(--text-on-dark)' }}>Ideas for your next cast</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--muted-on-dark)' }}>
            Your notes stay on this device until you choose “Draft this.”
          </p>
        </div>
        <button type="button" onClick={() => setCollapsed(true)} aria-label="Hide cast ideas" style={{ border: 'none', background: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', fontSize: 18, padding: 2 }}>×</button>
      </div>

      {sources.length === 0 && !loadingCasts ? (
        <div style={{ padding: 16, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted-on-dark)', fontSize: 13, lineHeight: 1.5 }}>
          Post a cast, save a note, or react to something in your feed to unlock personalized ideas here.
        </div>
      ) : null}

      {loadingCasts && sources.length === 0 ? (
        <div aria-live="polite" style={{ padding: 16, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted-on-dark)', fontSize: 13 }}>Finding a few ideas…</div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {sources.map((source) => {
          const isActive = activeSourceId === source.id;
          return (
            <article key={source.id} style={{ padding: '13px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 8, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>{sourceIcon(source.kind)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-on-dark)', marginBottom: 4 }}>{source.label}</div>
                  <p style={{ margin: 0, color: 'var(--muted-on-dark)', fontSize: 13, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{source.headline}</p>
                  <button
                    type="button"
                    onClick={() => createDrafts(source)}
                    disabled={isActive && drafts.length === 0 && !error}
                    style={{ marginTop: 10, padding: '7px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-on-dark)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {isActive && drafts.length === 0 && !error ? 'Drafting…' : 'Draft this'}
                  </button>
                </div>
              </div>

              {isActive && error ? <p role="alert" style={{ margin: '10px 0 0 36px', color: '#fca5a5', fontSize: 12 }}>{error}</p> : null}
              {isActive && drafts.length > 0 ? (
                <div style={{ display: 'grid', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  {drafts.map((draft) => (
                    <button
                      key={draft}
                      type="button"
                      onClick={() => onUseDraft(draft)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-on-dark)', textAlign: 'left', fontSize: 13, lineHeight: 1.45, cursor: 'pointer' }}
                    >
                      {draft}
                      <span style={{ display: 'block', marginTop: 6, color: 'var(--muted-on-dark)', fontSize: 11, fontWeight: 600 }}>Use this draft</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {sources.length > 0 ? (
        <button
          type="button"
          onClick={() => { setOffset((value) => value + 1); setActiveSourceId(null); setDrafts([]); setError(null); }}
          style={{ marginTop: 12, border: 'none', background: 'none', color: 'var(--muted-on-dark)', fontSize: 12, cursor: 'pointer', padding: '6px 0' }}
        >
          ↻ Refresh ideas
        </button>
      ) : null}
    </section>
  );
}
