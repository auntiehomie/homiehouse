'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from "next/link";
import HHLogo from '@/components/HHLogo';
import { useSearchParams } from 'next/navigation';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import AgentChat from '@/components/AgentChat';
import FeedCurationChat from '@/components/FeedCurationChat';
import { SUGGESTED_QUESTIONS } from '@/lib/ai/knowledge';
import SidebarNav from '@/components/SidebarNav';

function AskHomieContent() {
  const [castContext, setCastContext] = useState<any>(null);
  const [showCurationModal, setShowCurationModal] = useState(false);
  const [starterQuestion, setStarterQuestion] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const { fid } = useFarcasterAuth();
  const userId = fid ? `fid_${fid}` : undefined;

  useEffect(() => {
    const castData = searchParams.get('cast');
    if (castData) {
      try {
        setCastContext(JSON.parse(decodeURIComponent(castData)));
        localStorage.setItem('hh_ask_context', castData);
      } catch {}
    } else {
      const stored = localStorage.getItem('hh_ask_context');
      if (stored) {
        try { setCastContext(JSON.parse(decodeURIComponent(stored))); } catch {}
      }
    }
  }, [searchParams]);

  const clearContext = () => {
    setCastContext(null);
    localStorage.removeItem('hh_ask_context');
  };

  const handleCastSelect = (cast: string) => {
    navigator.clipboard.writeText(cast);
    alert('Cast copied to clipboard! Paste it in the compose view.');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)', color: 'var(--text-on-dark)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
        <div>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            <HHLogo size={36} />
          </Link>
          <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginTop: 2 }}>
            Ask Homie — AI assistant
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setShowCurationModal(true)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(180deg, #334155 0%, #1e293b 100%)',
              color: '#e2e8f0', border: '1px solid #475569', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            Curate Feed
          </button>
          <Link
            href="/"
            style={{ fontSize: 13, color: 'var(--muted-on-dark)', textDecoration: 'none' }}
          >
            ← Back
          </Link>
        </div>
      </header>

      {/* Body: sidebar + chat */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Desktop sidebar */}
        <aside
          className="hidden lg:block shrink-0"
          style={{ width: 220, borderRight: '1px solid var(--border)', overflowY: 'auto', scrollbarWidth: 'none', padding: '16px 0' }}
        >
          <SidebarNav />
        </aside>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 80 }}>
        {/* Cast context card */}
        {castContext && (
          <div style={{
            margin: '12px 16px 0',
            padding: '12px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-on-dark)' }}>
                Analyzing this cast
              </span>
              <button
                onClick={clearContext}
                style={{ fontSize: 12, color: 'var(--muted-on-dark)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Clear
              </button>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>
                <Link
                  href={`/profile?user=${castContext.author?.username || castContext.author}`}
                  style={{ color: 'var(--text-on-dark)', textDecoration: 'none' }}
                >
                  @{castContext.author?.username || castContext.author}
                </Link>
              </span>
              {castContext.author?.display_name && (
                <span style={{ color: 'var(--muted-on-dark)', marginLeft: 6 }}>
                  ({castContext.author.display_name})
                </span>
              )}
            </div>
            <div style={{
              marginTop: 8, padding: '8px 10px',
              background: 'var(--bg-dark)', borderRadius: 8,
              border: '1px solid var(--border)', fontSize: 13,
              color: 'var(--text-on-dark)', lineHeight: 1.5,
            }}>
              {castContext.text}
            </div>
            {(castContext.reactions || castContext.replies) && (
              <div style={{ marginTop: 8, display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted-on-dark)' }}>
                {castContext.reactions?.likes_count !== undefined && (
                  <span>❤️ {castContext.reactions.likes_count} likes</span>
                )}
                {castContext.reactions?.recasts_count !== undefined && (
                  <span>🔁 {castContext.reactions.recasts_count} recasts</span>
                )}
                {castContext.replies?.count !== undefined && (
                  <span>💬 {castContext.replies.count} replies</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Starter question chips */}
        {!castContext && (
          <div style={{ margin: '12px 16px 0' }}>
            <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginBottom: 8 }}>Ask about:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q.label}
                  onClick={() => setStarterQuestion(q.label)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 13,
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--muted-on-dark)', cursor: 'pointer',
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat */}
        <div style={{
          flex: 1, margin: '12px 16px 0',
          border: '1px solid var(--border)', borderRadius: 12,
          overflow: 'hidden', background: 'var(--surface)',
        }}>
          <AgentChat
            userId={userId || undefined}
            castContext={castContext}
            onCastSelect={handleCastSelect}
            initialMessage={starterQuestion || undefined}
          />
        </div>
        </main>
      </div>

      {showCurationModal && (
        <FeedCurationChat onClose={() => setShowCurationModal(false)} />
      )}
    </div>
  );
}

export default function AskHomiePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', color: 'var(--muted-on-dark)' }}>Loading…</div>}>
      <AskHomieContent />
    </Suspense>
  );
}
