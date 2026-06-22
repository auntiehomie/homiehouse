'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import HHLogo from '@/components/HHLogo';
import { ChannelSidebar } from '@/components/ChannelStrip';


// ─── Types ────────────────────────────────────────────────────────────────────

interface LearningModule {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  objectives: string[];
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

interface LearningPlan {
  track: 'learner' | 'creator' | 'financial' | 'all';
  level: 'beginner' | 'intermediate' | 'advanced';
  summary: string;
  modules: LearningModule[];
}

type PageState = 'quiz' | 'generating' | 'plan';
type Track = 'learner' | 'creator' | 'financial' | 'all';
type Level = 'beginner' | 'intermediate' | 'advanced';
type LearnTab = 'plan' | 'completed' | 'homie' | 'feed';

const LS_PLAN_KEY = 'hh_learning_plan';
const LS_PROGRESS_KEY = 'hh_learning_progress';
const LS_COMPLETIONS_KEY = 'hh_learning_completions';

// ─── Completed Lessons Tab ────────────────────────────────────────────────────

interface CompletionRecord {
  completedAt: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedMinutes: number;
}

function CompletedTab() {
  const router = useRouter();
  const [completions, setCompletions] = useState<Record<string, CompletionRecord>>({});
  const plan = (() => {
    try { return JSON.parse(localStorage.getItem(LS_PLAN_KEY) ?? 'null'); } catch { return null; }
  })();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_COMPLETIONS_KEY);
      if (raw) setCompletions(JSON.parse(raw));
    } catch {}
  }, []);

  const entries = Object.entries(completions).sort(
    (a, b) => new Date(b[1].completedAt).getTime() - new Date(a[1].completedAt).getTime()
  );

  const diffColor: Record<string, string> = { beginner: '#22c55e', intermediate: '#f97316', advanced: '#a855f7' };

  if (entries.length === 0) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-on-dark)', margin: '0 0 6px' }}>No completed lessons yet</p>
        <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', margin: 0 }}>Finish a module and it'll show up here.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
      <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', marginBottom: 16 }}>
        {entries.length} lesson{entries.length !== 1 ? 's' : ''} completed
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map(([moduleId, rec]) => {
          const formattedDate = new Date(rec.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          return (
            <div key={moduleId} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: diffColor[rec.difficulty] ?? 'var(--accent)', letterSpacing: '0.05em', textTransform: 'capitalize' }}>
                      {rec.difficulty}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted-on-dark)' }}>· {rec.estimatedMinutes} min</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-on-dark)' }}>· ✓ {formattedDate}</span>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)', margin: '0 0 4px', lineHeight: 1.3 }}>{rec.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
                    {rec.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (plan) {
                    const mod = plan.modules?.find((m: any) => m.id === moduleId);
                    if (mod) router.push(`/learn/module?id=${moduleId}`);
                  }
                }}
                style={{
                  alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8,
                  background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                  color: '#a5b4fc', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Review Lesson →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Learning Community Feed ──────────────────────────────────────────────────

const LEARNING_CHANNELS = [
  { id: '', label: 'All', query: '' },
  { id: 'defi', label: 'DeFi', query: 'DeFi' },
  { id: 'web3', label: 'Web3', query: 'web3' },
  { id: 'base', label: 'Base', query: 'Base chain' },
  { id: 'dao', label: 'DAOs', query: 'DAO' },
  { id: 'nft', label: 'NFTs', query: 'NFT' },
];

function LearningFeed() {
  const [channelId, setChannelId] = useState('');
  const [casts, setCasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    setCasts([]);
    setError(false);

    let fid: string | undefined;
    try {
      const p = JSON.parse(localStorage.getItem('hh_profile') || '{}');
      if (p?.fid) fid = String(p.fid);
    } catch {}

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const active = LEARNING_CHANNELS.find(c => c.id === channelId) ?? LEARNING_CHANNELS[0];
    // "All" → user's following feed; specific topic → keyword search (more reliable than channel feed)
    const url = active.query
      ? `/api/casts/search?q=${encodeURIComponent(active.query)}&limit=20`
      : `/api/feed?limit=20${fid ? `&fid=${fid}` : ''}`;

    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(d => { setCasts(d.data || d.casts || []); })
      .catch(() => { setError(true); })
      .finally(() => { clearTimeout(timer); setLoading(false); });

    return () => { controller.abort(); clearTimeout(timer); };
  }, [channelId, retryCount]);

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Channel pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}>
        {LEARNING_CHANNELS.map(ch => (
          <button
            key={ch.id}
            onClick={() => setChannelId(ch.id)}
            style={{
              flexShrink: 0, padding: '5px 14px', borderRadius: 20, fontSize: 13,
              fontWeight: channelId === ch.id ? 700 : 400,
              background: channelId === ch.id ? 'var(--accent)' : 'transparent',
              color: channelId === ch.id ? '#fff' : 'var(--muted-on-dark)',
              border: `1px solid ${channelId === ch.id ? 'var(--accent)' : 'var(--border)'}`,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted-on-dark)' }}>Loading…</div>
      )}
      {!loading && error && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted-on-dark)' }}>
          <p style={{ marginBottom: 12 }}>Couldn't load feed</p>
          <button
            onClick={() => setRetryCount(n => n + 1)}
            style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-on-dark)', cursor: 'pointer', fontSize: 13 }}
          >
            Retry
          </button>
        </div>
      )}
      {!loading && !error && casts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted-on-dark)' }}>No posts found</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {casts.map((cast: any) => {
          const author = cast.author;
          return (
            <a
              key={cast.hash}
              href={`/cast/${cast.hash}`}
              style={{
                display: 'block', padding: '14px', borderRadius: 12,
                background: 'var(--surface)', border: '1px solid var(--border)',
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {author?.pfp_url && (
                  <Image src={author.pfp_url} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                )}
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--text-on-dark)' }}>{author?.display_name || author?.username}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-on-dark)', margin: 0 }}>@{author?.username}</p>
                </div>
              </div>
              <p style={{ fontSize: 14, margin: 0, lineHeight: 1.55, color: 'var(--text-on-dark)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {cast.text}
              </p>
              <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 12, color: 'var(--muted-on-dark)' }}>
                <span>❤️ {cast.reactions?.likes_count ?? 0}</span>
                <span>💬 {cast.replies?.count ?? 0}</span>
                <span>🔁 {cast.reactions?.recasts_count ?? 0}</span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GradCapIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}

// ─── Difficulty Badge ─────────────────────────────────────────────────────────

function DifficultyBadge({ level }: { level: 'beginner' | 'intermediate' | 'advanced' }) {
  const labels: Record<string, string> = {
    beginner: '🌱 Beginner',
    intermediate: '🔥 Intermediate',
    advanced: '⚡ Advanced',
  };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      border: '1px solid var(--border)', color: 'var(--muted-on-dark)', whiteSpace: 'nowrap',
    }}>
      {labels[level] || level}
    </span>
  );
}

// ─── Module Card ──────────────────────────────────────────────────────────────

function ModuleCard({ module, index, completed, onToggle, onNavigate }: {
  module: LearningModule; index: number; completed: boolean; onToggle: (id: string) => void; onNavigate: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      overflow: 'hidden', opacity: completed ? 0.65 : 1, transition: 'opacity 0.2s',
    }}>
      <div
        style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(module.id); }}
          aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
          style={{
            flexShrink: 0, marginTop: 2, width: 22, height: 22, borderRadius: 6,
            border: `2px solid ${completed ? 'var(--accent)' : 'var(--border)'}`,
            background: completed ? 'var(--accent)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {completed && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="var(--bg-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-on-dark)', fontVariantNumeric: 'tabular-nums' }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-on-dark)', textDecoration: completed ? 'line-through' : 'none' }}>
              {module.title}
            </span>
            <DifficultyBadge level={module.difficulty} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.5 }}>
            {module.description}
          </p>
        </div>

        <span style={{ flexShrink: 0, color: 'var(--muted-on-dark)', fontSize: 14, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', marginTop: 2 }}>
          ▾
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '0 18px 18px 54px', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ padding: '10px 14px', background: 'var(--bg-dark)', borderRadius: 10, borderLeft: '3px solid var(--accent)', marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text-on-dark)', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
              💡 {module.whyItMatters}
            </p>
          </div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-on-dark)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            What you'll learn
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {module.objectives.map((obj, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-on-dark)', lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0, color: 'var(--accent)', marginTop: 1 }}>→</span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>⏱ ~{module.estimatedMinutes} min</span>
            <span style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
            {module.tags.map((tag) => (
              <span key={tag} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, border: '1px solid var(--border)', color: 'var(--muted-on-dark)' }}>{tag}</span>
            ))}
          </div>
          <button
            onClick={() => onNavigate(module.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14,
              padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
            }}
          >
            {completed ? 'Review Module' : 'Start Module'}
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Ask Homie Read Panel ─────────────────────────────────────────────────────

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  type?: 'url-summary';
  url?: string;
  title?: string;
}

const URL_RE = /https?:\/\/[^\s"'<>]+/;

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (!line.trim()) { nodes.push(<br key={key++} />); continue; }
    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      nodes.push(<p key={key++} style={{ fontWeight: 700, color: 'var(--text-on-dark)', margin: '10px 0 4px', fontSize: 14 }}>{line.slice(2, -2)}</p>);
    } else if (/^\*\*(.+)\*\*/.test(line)) {
      const rendered = line.replace(/\*\*(.+?)\*\*/g, (_, m) => `<strong>${m}</strong>`);
      nodes.push(<p key={key++} style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text-on-dark)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: rendered }} />);
    } else if (line.startsWith('• ') || line.startsWith('- ')) {
      nodes.push(
        <div key={key++} style={{ display: 'flex', gap: 8, margin: '3px 0' }}>
          <span style={{ flexShrink: 0, color: 'var(--accent)', fontSize: 14 }}>→</span>
          <span style={{ fontSize: 14, color: 'var(--text-on-dark)', lineHeight: 1.55 }}>{line.slice(2)}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      nodes.push(
        <div key={key++} style={{ display: 'flex', gap: 8, margin: '3px 0' }}>
          <span style={{ flexShrink: 0, color: 'var(--accent)', fontSize: 14, minWidth: 16 }}>{line.match(/^\d+/)?.[0]}.</span>
          <span style={{ fontSize: 14, color: 'var(--text-on-dark)', lineHeight: 1.55 }}>{line.replace(/^\d+\.\s/, '')}</span>
        </div>
      );
    } else {
      nodes.push(<p key={key++} style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text-on-dark)', lineHeight: 1.65 }}>{line}</p>);
    }
  }
  return nodes;
}

function HomieReadPanel({ currentPlan }: { currentPlan: LearningPlan | null }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const STARTERS = [
    { label: '📰 Paste an article URL to summarize', value: '' },
    { label: 'What is liquidity in DeFi?', value: 'What is liquidity in DeFi?' },
    { label: 'Explain Bitcoin vs Ethereum simply', value: 'Explain Bitcoin vs Ethereum simply' },
    { label: 'How do I read a crypto news article critically?', value: 'How do I read a crypto news article critically?' },
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const saveToNotes = (msg: ChatMsg) => {
    try {
      const raw = localStorage.getItem('hh_notes');
      const notes = raw ? JSON.parse(raw) : [];
      const note = {
        id: Date.now().toString(),
        title: msg.title || 'Ask Homie Summary',
        content: msg.content,
        tags: ['homie-summary', ...(msg.url ? ['web-article'] : [])],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: msg.url,
      };
      localStorage.setItem('hh_notes', JSON.stringify([note, ...notes]));
      alert('Saved to Notes!');
    } catch { alert('Could not save to Notes'); }
  };

  const sendMessage = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput('');

    const userMsg: ChatMsg = { role: 'user', content: trimmed };
    const urlMatch = trimmed.match(URL_RE);

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      if (urlMatch) {
        // URL summarization mode
        const url = urlMatch[0];
        const res = await fetch('/api/summarize-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to summarize');
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data.summary,
          type: 'url-summary',
          url: data.url,
          title: data.title,
        }]);
      } else {
        // Regular AI Q&A mode
        const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
        history.push({ role: 'user', content: trimmed });

        const planContext = currentPlan
          ? `\n\n[User's current learning track: ${currentPlan.track}, level: ${currentPlan.level}. Modules: ${currentPlan.modules.map(m => m.title).join(', ')}]`
          : '';

        const res = await fetch('/api/ask-homie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.map((m, i) =>
              i === history.length - 1 && planContext
                ? { ...m, content: m.content + planContext }
                : m
            ),
            mode: 'agent',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No response');
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data.response || 'No response received.',
        }]);
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: err.message || 'Something went wrong. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 100px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Intro */}
      {messages.length === 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            padding: '18px 20px', borderRadius: 14,
            background: 'linear-gradient(135deg, #1e1b4b 0%, #1a1a2e 100%)',
            border: '1px solid #3730a3', marginBottom: 16,
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#e0e7ff', margin: '0 0 6px' }}>Ask Homie</p>
            <p style={{ fontSize: 14, color: '#a5b4fc', margin: 0, lineHeight: 1.65 }}>
              Paste any article URL to get a plain-language summary, or ask a question about Web3, DeFi, or what you're learning.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STARTERS.slice(1).map((s) => (
              <button
                key={s.label}
                onClick={() => sendMessage(s.value)}
                style={{
                  width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--muted-on-dark)', fontSize: 13, cursor: 'pointer',
                  transition: 'border-color 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'user' ? (
              <div style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: '14px 14px 4px 14px',
                background: 'var(--accent)', color: '#fff',
                fontSize: 14, lineHeight: 1.55,
              }}>
                {msg.content}
              </div>
            ) : (
              <div style={{ width: '100%' }}>
                {msg.type === 'url-summary' && msg.url && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                    padding: '8px 12px', borderRadius: 8,
                    background: 'var(--bg-dark)', border: '1px solid var(--border)',
                    fontSize: 12, color: 'var(--muted-on-dark)',
                  }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <a href={msg.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                      {msg.title || msg.url}
                    </a>
                  </div>
                )}
                <div style={{
                  padding: '14px 16px', borderRadius: '4px 14px 14px 14px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                }}>
                  {renderMarkdown(msg.content)}
                </div>
                {msg.type === 'url-summary' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => saveToNotes(msg)}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'transparent', border: '1px solid var(--border)',
                        color: 'var(--muted-on-dark)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Save to Notes
                    </button>
                    <button
                      onClick={() => {
                        const shareText = `Read this: ${msg.url}\n\nKey insight: ${msg.content.slice(0, 200)}...`;
                        router.push(`/compose?text=${encodeURIComponent(shareText)}`);
                      }}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'transparent', border: '1px solid var(--border)',
                        color: 'var(--muted-on-dark)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Cast this
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: '4px 14px 14px 14px', background: 'var(--surface)', border: '1px solid var(--border)', width: 'fit-content' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
                  animation: `homieTyping 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
            <style>{`@keyframes homieTyping{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
            <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>Homie is reading...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        position: 'sticky', bottom: 72, marginTop: 16,
        background: 'var(--bg-dark)', borderRadius: 14,
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste a URL or ask a question... (Enter to send)"
          rows={2}
          style={{
            width: '100%', padding: '12px 14px', background: 'transparent',
            border: 'none', outline: 'none', resize: 'none',
            color: 'var(--text-on-dark)', fontSize: 14, lineHeight: 1.5,
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px 10px' }}>
          <span style={{ fontSize: 11, color: 'var(--muted-on-dark)' }}>
            {URL_RE.test(input) ? '🔗 URL detected — will summarize' : 'Shift+Enter for new line'}
          </span>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: input.trim() && !loading ? 'var(--accent)' : 'var(--surface)',
              color: input.trim() && !loading ? '#fff' : 'var(--muted-on-dark)',
              border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page Content ─────────────────────────────────────────────────────────────

function LearnPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('quiz');
  const [activeTab, setActiveTab] = useState<LearnTab>('plan');
  const [step, setStep] = useState(1);
  const [track, setTrack] = useState<Track | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [levelIdx, setLevelIdx] = useState<number | null>(null);
  const [goals, setGoals] = useState('');
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [learnerCount, setLearnerCount] = useState(0);
  const [contentVisible, setContentVisible] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [planPersonalizing, setPlanPersonalizing] = useState(false);
  const [hh2Points, setHh2Points] = useState(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const HH2_PER_LESSON = 10;

  // Deep-link pre-selection
  useEffect(() => {
    const t = searchParams.get('track') as Track | null;
    const valid: Track[] = ['learner', 'creator', 'financial', 'all'];
    if (t && valid.includes(t)) setTrack(t);
    if (searchParams.get('tab') === 'homie') setActiveTab('homie');
  }, [searchParams]);

  // Load persisted data
  useEffect(() => {
    try {
      const storedPlan = localStorage.getItem(LS_PLAN_KEY);
      const storedProgress = localStorage.getItem(LS_PROGRESS_KEY);
      if (storedPlan) { setPlan(JSON.parse(storedPlan) as LearningPlan); setPageState('plan'); }
      if (storedProgress) setCompletedIds(new Set(JSON.parse(storedProgress) as string[]));
    } catch { }
  }, []);

  useEffect(() => {
    if (plan) { try { localStorage.setItem(LS_PLAN_KEY, JSON.stringify(plan)); } catch { } }
  }, [plan]);

  useEffect(() => {
    if (plan) { try { localStorage.setItem(LS_PROGRESS_KEY, JSON.stringify([...completedIds])); } catch { } }
  }, [completedIds, plan]);

  useEffect(() => {
    fetch('/api/learner-count').then(r => r.json()).then(d => setLearnerCount(d.count || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setContentVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  // ─── Neon cross-device sync ───────────────────────────────────────────────

  const getFid = (): number | null => {
    try {
      const p = JSON.parse(localStorage.getItem('hh_profile') || '{}');
      return p?.fid ? Number(p.fid) : null;
    } catch { return null; }
  };

  // On mount: if FID available, load progress from Neon (overrides localStorage)
  useEffect(() => {
    const fid = getFid();
    if (!fid) return;
    fetch(`/api/learning-progress?fid=${fid}`)
      .then(r => r.json())
      .then(d => {
        if (!d.found || !d.plan) return;
        setPlan(d.plan);
        setCompletedIds(new Set(d.completed_ids ?? []));
        setPageState('plan');
        try { localStorage.setItem(LS_PLAN_KEY, JSON.stringify(d.plan)); } catch {}
        try { localStorage.setItem(LS_PROGRESS_KEY, JSON.stringify(d.completed_ids ?? [])); } catch {}
        if (d.completions && Object.keys(d.completions).length > 0) {
          try { localStorage.setItem(LS_COMPLETIONS_KEY, JSON.stringify(d.completions)); } catch {}
        }
        if (typeof d.hh2_points === 'number') setHh2Points(d.hh2_points);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save: whenever plan or completedIds change, sync to Neon after 2s
  useEffect(() => {
    if (!plan) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      const fid = getFid();
      if (!fid) return;
      const completions = (() => {
        try { return JSON.parse(localStorage.getItem(LS_COMPLETIONS_KEY) ?? '{}'); } catch { return {}; }
      })();
      fetch('/api/learning-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid, plan, completed_ids: [...completedIds], completions, hh2_points: completedIds.size * HH2_PER_LESSON }),
      }).catch(() => {});
    }, 2000);
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, completedIds]);

  const navigateToModule = useCallback((id: string) => {
    setNavigating(true);
    setTimeout(() => router.push(`/learn/module?id=${id}`), 200);
  }, [router]);

  const toggleModule = useCallback((id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      setHh2Points(next.size * HH2_PER_LESSON);
      return next;
    });
  }, [HH2_PER_LESSON]);

  const generatePlan = async () => {
    if (!track || !level) return;
    setError(null);

    // Show fallback plan instantly — no spinner needed
    let fallbackShown = false;
    try {
      const fallbackRes = await fetch(`/api/learning-plan?track=${track}&level=${level}`);
      if (fallbackRes.ok) {
        const fallbackPlan = await fallbackRes.json() as LearningPlan;
        setPlan(fallbackPlan);
        setCompletedIds(new Set());
        setPageState('plan');
        fallbackShown = true;
      }
    } catch {
      // proceed to generating spinner if GET failed
    }

    if (!fallbackShown) setPageState('generating');

    // AI personalization fires in the background while user already sees the plan
    setPlanPersonalizing(true);
    try {
      const res = await fetch('/api/learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track, level, specificGoals: goals }),
      });
      if (!res.ok) throw new Error('Failed to generate plan');
      const data = await res.json() as LearningPlan;
      setPlan(data); setCompletedIds(new Set()); setPageState('plan');
    } catch (err: any) {
      if (!fallbackShown) {
        setError(err?.message || 'Something went wrong. Please try again.');
        setPageState('quiz'); setStep(3);
      }
      // silently keep fallback plan if AI personalisation fails
    } finally {
      setPlanPersonalizing(false);
    }
  };

  const startOver = () => {
    setPlan(null); setCompletedIds(new Set()); setTrack(null); setLevel(null);
    setLevelIdx(null); setGoals(''); setStep(1); setPageState('quiz');
    try { localStorage.removeItem(LS_PLAN_KEY); localStorage.removeItem(LS_PROGRESS_KEY); } catch { }
  };

  const shareProgress = () => {
    if (!plan) return;
    const total = plan.modules.length;
    const done = completedIds.size;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const progressLine = pct === 0 ? 'Just getting started 🌱' : pct < 50 ? 'Making progress 🔥' : pct < 100 ? 'Almost there 💪' : 'Plan complete! 🎉';
    const text = `📚 My Web3 Learning Journey on HomieHouse\n\nTrack: ${plan.track} | Level: ${plan.level}\nProgress: ${done}/${total} modules (${pct}%)\n\n${progressLine}\n\nBuilding my path to decentralization, one step at a time.`;
    router.push(`/compose?text=${encodeURIComponent(text)}`);
  };

  // ─── Options ──────────────────────────────────────────────────────────────

  const trackOptions: { id: Track; emoji: string; title: string; subtitle: string }[] = [
    { id: 'learner',   emoji: '🧠', title: 'Learner',          subtitle: 'I want to understand how this all works' },
    { id: 'creator',   emoji: '🛠️', title: 'Creator',          subtitle: 'I want to build and create things on-chain' },
    { id: 'financial', emoji: '💰', title: 'Financial',        subtitle: 'I want to grow and manage my assets' },
    { id: 'all',       emoji: '✨', title: 'All of the above', subtitle: 'I want the full picture' },
  ];
  const levelOptions: { label: string; description: string; level: Level }[] = [
    { label: 'Complete beginner', description: "I've heard the terms but don't really get it",       level: 'beginner' },
    { label: 'Some context',      description: "I've used a crypto app or two",                      level: 'beginner' },
    { label: 'Getting there',     description: "I've traded, used DeFi, or joined a DAO",            level: 'intermediate' },
    { label: 'Advanced',          description: "I'm already building but want structured knowledge",  level: 'advanced' },
  ];
  const goalChips = ['Financial independence', 'Build something', 'Understand the ecosystem', 'Connect with communities'];

  // ─── Shared layout ────────────────────────────────────────────────────────

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)', color: 'var(--text-on-dark)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              <HHLogo size={36} />
            </Link>
            <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginTop: 2 }}>Learning Hub</p>
          </div>
          <Link href="/feed" style={{ fontSize: 13, color: 'var(--muted-on-dark)', textDecoration: 'none' }}>← Feed</Link>
        </div>

        {/* Tab nav — always visible */}
        <div style={{ display: 'flex', gap: 0, padding: '0 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {([
            { id: 'plan' as LearnTab, label: 'My Plan', icon: '📚' },
            { id: 'completed' as LearnTab, label: 'Completed', icon: '✅' },
            { id: 'homie' as LearnTab, label: 'Ask Homie', icon: '🤖' },
            { id: 'feed' as LearnTab, label: 'Feed', icon: '📰' },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 18px', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
                background: 'none', border: 'none', cursor: 'pointer',
                color: activeTab === tab.id ? 'var(--text-on-dark)' : 'var(--muted-on-dark)',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <aside className="hidden lg:block shrink-0" style={{ width: 220, borderRight: '1px solid var(--border)', overflowY: 'auto', scrollbarWidth: 'none', padding: '16px 0' }}>
          <ChannelSidebar />
        </aside>
        <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
          {activeTab === 'homie'
            ? <HomieReadPanel currentPlan={plan} />
            : activeTab === 'feed'
            ? <LearningFeed />
            : activeTab === 'completed'
            ? <CompletedTab />
            : children
          }
        </main>
      </div>
    </div>
  );

  // ─── Generating ───────────────────────────────────────────────────────────

  if (pageState === 'generating') {
    return wrap(
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24, padding: '40px 20px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'hhSpin 0.8s linear infinite' }} />
        <style>{`@keyframes hhSpin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-on-dark)', margin: 0 }}>Building your personalized path...</p>
          <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', marginTop: 8, margin: '8px 0 0' }}>Crafting a curriculum just for you</p>
        </div>
      </div>,
    );
  }

  // ─── Plan view ────────────────────────────────────────────────────────────

  if (pageState === 'plan' && plan) {
    const total = plan.modules.length;
    const done = completedIds.size;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const totalMinutes = plan.modules.reduce((s, m) => s + m.estimatedMinutes, 0);
    const trackLabel = plan.track.charAt(0).toUpperCase() + plan.track.slice(1);
    const levelLabel = plan.level.charAt(0).toUpperCase() + plan.level.slice(1);

    return wrap(
      <div style={{
        maxWidth: 720, margin: '0 auto', padding: '24px 16px',
        opacity: navigating ? 0 : (contentVisible ? 1 : 0),
        transform: navigating ? 'translateY(-8px)' : (contentVisible ? 'translateY(0)' : 'translateY(10px)'),
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <GradCapIcon size={22} />
            <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 12px', border: '1px solid var(--accent)', borderRadius: 20, color: 'var(--accent)' }}>{trackLabel}</span>
            <span style={{ fontSize: 13, fontWeight: 600, padding: '4px 12px', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--muted-on-dark)' }}>{levelLabel}</span>
            <span style={{ fontSize: 13, color: 'var(--muted-on-dark)', marginLeft: 4 }}>{total} modules · ~{totalMinutes} min total</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-on-dark)', lineHeight: 1.3 }}>Your Learning Path</h1>
          <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.6 }}>{plan.summary}</p>
        </div>

        {/* Personalizing banner */}
        {planPersonalizing && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)',
            fontSize: 13, color: '#a5b4fc',
          }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #a5b4fc', borderTopColor: 'transparent', animation: 'hhSpin 0.8s linear infinite', flexShrink: 0 }} />
            ✨ Personalizing your plan based on your goals…
          </div>
        )}

        {/* Progress */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)' }}>Progress</span>
            <span style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>{done}/{total} modules · {pct}%</span>
          </div>
          {/* HH2 points earned */}
          {hh2Points > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>🪙 HH2 Points Earned</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{hh2Points.toLocaleString()} HH2</span>
            </div>
          )}
          <div style={{ height: 8, background: 'var(--bg-dark)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
          {learnerCount > 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginTop: 10, textAlign: 'right' }}>
              🧑‍🎓 {learnerCount} people learning with HomieHouse
            </p>
          )}
          {pct === 100 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 15, color: '#fbbf24', fontWeight: 700, margin: '0 0 4px' }}>
                🎉 Congratulations! Give yourself a pat on the back!
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.5 }}>
                You've completed your learning path. Ready to go deeper? Hit "Start New Plan" below to continue your journey.
              </p>
            </div>
          )}
          {/* Ask Homie nudge */}
          {pct > 0 && pct < 100 && (
            <button
              onClick={() => setActiveTab('homie')}
              style={{
                marginTop: 10, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                color: '#a5b4fc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              🤖 Ask Homie to help you understand a topic or article →
            </button>
          )}
        </div>

        {/* Modules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {plan.modules.map((mod, i) => (
            <ModuleCard key={mod.id} module={mod} index={i} completed={completedIds.has(mod.id)} onToggle={toggleModule} onNavigate={navigateToModule} />
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={shareProgress}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: '1px solid var(--accent)', background: 'transparent',
              color: 'var(--accent)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s',
            }}
          >
            Share Progress
          </button>
          <Link href="/hh2" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '12px', borderRadius: 12, border: '1px solid rgba(251,191,36,0.4)',
            background: 'rgba(251,191,36,0.06)', color: '#fbbf24',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            🪙 View HH2 Tokenomics & How to Earn
          </Link>
          <button
            onClick={startOver}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--muted-on-dark)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {pct === 100 ? 'Start New Plan' : 'Start Over'}
          </button>
        </div>
      </div>,
    );
  }

  // ─── Quiz ─────────────────────────────────────────────────────────────────

  return wrap(
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 16px' }}>
      {/* Page title */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <GradCapIcon size={36} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-on-dark)' }}>
          The Learning Hub
        </h1>
        <p style={{ fontSize: 15, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.6 }}>
          Get a personalized path into Web3 — tailored to your goals and level.
        </p>
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{ width: s === step ? 24 : 8, height: 8, borderRadius: 4, background: s === step ? 'var(--accent)' : s < step ? 'var(--accent)' : 'var(--border)', transition: 'all 0.25s', opacity: s < step ? 0.4 : 1 }} />
        ))}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* ── Step 1: Track ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-on-dark)' }}>What's your journey?</h2>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 16px' }}>Pick the path that fits where you want to go.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {trackOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => { setTrack(opt.id); setStep(2); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 12,
                  border: `2px solid ${track === opt.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: track === opt.id ? 'rgba(255,255,255,0.04)' : 'var(--surface)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-on-dark)', margin: 0 }}>{opt.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '2px 0 0' }}>{opt.subtitle}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Try first shortcut */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 10px', textAlign: 'center' }}>Not sure yet?</p>
            <button
              onClick={() => {
                const starterPlan: LearningPlan = {
                  track: 'learner',
                  level: 'beginner',
                  summary: 'A quick taste of the HomieHouse learning experience.',
                  modules: [{
                    id: 'wallet-basics',
                    title: 'Your First Crypto Wallet',
                    description: 'Learn what a crypto wallet is, how it works, and how to set one up safely.',
                    whyItMatters: 'Your wallet is your identity and bank account in Web3 — without it, you cannot participate.',
                    objectives: ['Understand what a seed phrase is and why it must be kept secret', 'Set up a self-custody wallet like MetaMask or Coinbase Wallet', 'Know the difference between hot and cold wallets', 'Send and receive your first transaction safely'],
                    estimatedMinutes: 25,
                    difficulty: 'beginner',
                    tags: ['wallet', 'security', 'basics'],
                  }],
                };
                try { localStorage.setItem(LS_PLAN_KEY, JSON.stringify(starterPlan)); } catch {}
                router.push('/learn/module?id=wallet-basics');
              }}
              style={{
                width: '100%', padding: '13px 18px', borderRadius: 12,
                background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.4)',
                color: '#a5b4fc', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              Try a lesson first →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Level ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-on-dark)' }}>Where are you starting from?</h2>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 16px' }}>Be honest — this shapes everything.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {levelOptions.map((opt, i) => (
              <button
                key={opt.label}
                onClick={() => { setLevel(opt.level); setLevelIdx(i); }}
                style={{
                  display: 'flex', flexDirection: 'column', padding: '14px 18px', borderRadius: 12, textAlign: 'left',
                  border: `2px solid ${levelIdx === i ? 'var(--accent)' : 'var(--border)'}`,
                  background: levelIdx === i ? 'rgba(255,255,255,0.04)' : 'var(--surface)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-on-dark)', margin: 0 }}>{opt.label}</p>
                <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '3px 0 0' }}>{opt.description}</p>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(1)} style={{ flex: '0 0 auto', padding: '14px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-on-dark)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
              ← Back
            </button>
            <button
              disabled={levelIdx === null}
              onClick={() => setStep(3)}
              style={{
                flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                background: levelIdx !== null ? 'var(--btn-primary-bg)' : 'var(--surface)',
                color: levelIdx !== null ? 'var(--btn-primary-color)' : 'var(--muted-on-dark)',
                fontSize: 15, fontWeight: 600, cursor: levelIdx !== null ? 'pointer' : 'not-allowed',
                opacity: levelIdx !== null ? 1 : 0.5, transition: 'all 0.15s',
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Goals ─────────────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-on-dark)' }}>What's your main goal right now?</h2>
          <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', margin: '0 0 16px' }}>Tell us what you're working toward — or pick a quick option below.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {goalChips.map((chip) => {
              const active = goals === chip;
              return (
                <button
                  key={chip}
                  onClick={() => setGoals(active ? '' : chip)}
                  style={{
                    padding: '6px 14px', borderRadius: 20,
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--muted-on-dark)',
                    fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {chip}
                </button>
              );
            })}
          </div>
          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="e.g. I want to understand how to not rely on banks, or I want to launch my own token..."
            rows={4}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-on-dark)', fontSize: 14, lineHeight: 1.6,
              resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 20,
            }}
            onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'var(--accent)'; }}
            onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = 'var(--border)'; }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(2)} style={{ flex: '0 0 auto', padding: '14px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-on-dark)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
              ← Back
            </button>
            <button
              onClick={generatePlan}
              style={{
                flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-color)',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.15s',
              }}
            >
              <GradCapIcon size={16} /> Generate My Plan
            </button>
          </div>
        </div>
      )}
    </div>,
  );
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', color: 'var(--muted-on-dark)' }}>Loading…</div>}>
      <LearnPageContent />
    </Suspense>
  );
}
