"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useFarcasterWrites } from "@/hooks/useFarcasterWrites";
import SmartEmbed from "@/components/SmartEmbed";

function renderCastText(text: string) {
  const parts = text.split(/(\$[A-Z][A-Z0-9]{0,9})/g);
  return parts.map((part, i) =>
    /^\$[A-Z][A-Z0-9]{0,9}$/.test(part) ? (
      <Link key={i} href={`/tokens/${encodeURIComponent(part.slice(1))}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>
        {part}
      </Link>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

function ActionBtn({ onClick, icon, label, active = false, disabled = false }: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
        border: 'none',
        color: active ? 'var(--text-on-dark)' : 'var(--muted-on-dark)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 13, fontWeight: active ? 600 : 400,
        padding: '5px 9px', borderRadius: 8,
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0, whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export default function CastDetailPage() {
  const params = useParams();
  const router = useRouter();
  const hash = params?.hash as string;

  const [cast, setCast] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [recasted, setRecasted] = useState(false);
  const [recastCount, setRecastCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [replyingTo, setReplyingTo] = useState<{ hash: string; fid: number; name: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const { likeCast, unlikeCast, recast: recastFn, removeRecast, reply } = useFarcasterWrites();

  const fetchCastDetail = useCallback(async () => {
    if (!hash) return;
    try {
      const response = await fetch(`/api/cast?hash=${encodeURIComponent(hash)}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch cast');
      }
      const data = await response.json();
      setCast(data.cast);
      setLikeCount(data.cast?.reactions?.likes_count || 0);
      setRecastCount(data.cast?.reactions?.recasts_count || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load cast');
    }
  }, [hash]);

  useEffect(() => {
    if (!hash) { setError("No cast hash provided"); setLoading(false); return; }
    fetchCastDetail().finally(() => setLoading(false));
  }, [hash, fetchCastDetail]);

  const handleLike = async () => {
    if (!cast) return;
    setActionLoading('like');
    try {
      if (liked) {
        await unlikeCast({ targetCastHash: cast.hash, targetCastFid: cast.author?.fid });
        setLiked(false);
        setLikeCount(c => Math.max(0, c - 1));
      } else {
        await likeCast({ targetCastHash: cast.hash, targetCastFid: cast.author?.fid });
        setLiked(true);
        setLikeCount(c => c + 1);
      }
    } catch (e: any) {
      alert(e?.message ?? 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecast = async () => {
    if (!cast) return;
    setActionLoading('recast');
    try {
      if (recasted) {
        await removeRecast({ targetCastHash: cast.hash, targetCastFid: cast.author?.fid });
        setRecasted(false);
        setRecastCount(c => Math.max(0, c - 1));
      } else {
        await recastFn({ targetCastHash: cast.hash, targetCastFid: cast.author?.fid });
        setRecasted(true);
        setRecastCount(c => c + 1);
      }
    } catch (e: any) {
      alert(e?.message ?? 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const submitReply = async () => {
    if (!replyText.trim() || !replyingTo) return;
    setReplying(true);
    try {
      await reply({ text: replyText.trim(), parentCastHash: replyingTo.hash, parentCastFid: replyingTo.fid });
      setReplyingTo(null);
      setReplyText('');
      await fetchCastDetail();
    } catch (e: any) {
      alert(e?.message ?? 'Reply failed');
    } finally {
      setReplying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--muted-on-dark)', fontSize: 15 }}>Loading…</span>
      </div>
    );
  }

  if (error || !cast) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>😔</div>
          <div style={{ color: 'var(--text-on-dark)', fontWeight: 600, marginBottom: 8 }}>Cast not found</div>
          <div style={{ color: 'var(--muted-on-dark)', fontSize: 14, marginBottom: 20 }}>{error}</div>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', fontSize: 14 }}>← Back</button>
        </div>
      </div>
    );
  }

  const author = cast.author;
  const authorName = author?.display_name || author?.username || 'Unknown';
  const authorUsername = author?.username || '';
  const authorPfp = author?.pfp_url;
  const text = cast.text || '';
  const embeds = cast.embeds || [];
  const replies = cast.replies?.casts || cast.direct_replies || [];
  const parentChain: any[] = cast.parent_chain || [];

  let timeLabel = '';
  if (cast.timestamp) {
    try {
      const d = new Date(cast.timestamp);
      if (!isNaN(d.getTime())) timeLabel = formatDistanceToNow(d, { addSuffix: true });
    } catch {}
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-on-dark)', paddingBottom: 80 }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, background: 'var(--bg-dark)', zIndex: 10 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span style={{ fontSize: 17, fontWeight: 600 }}>Cast</span>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 0' }}>

        {/* Parent chain */}
        {parentChain.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {parentChain.map((pc: any, idx: number) => {
              const pca = pc.author;
              const pcName = pca?.display_name || pca?.username || 'Unknown';
              const pcUsername = pca?.username || '';
              const pcPfp = pca?.pfp_url;
              return (
                <div key={pc.hash || idx} style={{ position: 'relative', marginBottom: 0 }}>
                  <Link href={`/cast/${pc.hash}`} style={{ textDecoration: 'none' }}>
                    <div style={{ ...cardStyle, borderRadius: idx === 0 ? '12px 12px 0 0' : 0, borderBottom: 'none', padding: '12px 16px', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        {pcPfp
                          ? <img src={pcPfp} alt={pcName} style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
                          : <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-on-dark)' }}>{pcName}</span>
                            <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>@{pcUsername}</span>
                          </div>
                          <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-on-dark)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {renderCastText(pc.text || '')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                  {/* Thread line */}
                  <div style={{ position: 'absolute', left: 32, bottom: 0, width: 2, height: 12, background: 'var(--border)', zIndex: 1 }} />
                </div>
              );
            })}
            {/* Connector into main cast */}
            <div style={{ height: 12, borderLeft: '2px solid var(--border)', marginLeft: 31 }} />
          </div>
        )}

        {/* Main cast */}
        <div style={cardStyle}>
          {/* Author */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {authorPfp
              ? <img src={authorPfp} alt={authorName} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
            }
            <div>
              <Link href={`/profile?user=${authorUsername}`} style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-on-dark)', textDecoration: 'none' }}>
                {authorName}
              </Link>
              <div style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>@{authorUsername}</div>
            </div>
          </div>

          {/* Text */}
          <div style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-on-dark)' }}>
            {renderCastText(text)}
          </div>

          {/* Embeds */}
          {embeds.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {embeds.map((embed: any, idx: number) => {
                if (!embed.url) return null;
                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(embed.url) || /imagedelivery\.net|imgur\.com/i.test(embed.url);
                if (isImage) {
                  return <img key={idx} src={embed.url} alt="" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />;
                }
                return <SmartEmbed key={idx} url={embed.url} castHash={cast.hash} />;
              })}
            </div>
          )}

          {/* Timestamp */}
          <div style={{ fontSize: 13, color: 'var(--muted-on-dark)', paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            {timeLabel}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 4 }}>
            <ActionBtn
              active={liked}
              disabled={actionLoading === 'like'}
              onClick={handleLike}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              }
              label={String(likeCount)}
            />
            <ActionBtn
              active={recasted}
              disabled={actionLoading === 'recast'}
              onClick={handleRecast}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              }
              label={recasted ? 'Recasted' : String(recastCount)}
            />
            <ActionBtn
              active={false}
              onClick={() => setReplyingTo({ hash: cast.hash, fid: cast.author?.fid, name: authorName })}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              }
              label={String(cast.replies?.count || 0)}
            />
          </div>
        </div>

        {/* Inline reply composer */}
        {replyingTo && (
          <div style={{ ...cardStyle, marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginBottom: 8 }}>Replying to {replyingTo.name}</div>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write your reply…"
              rows={3}
              style={{ width: '100%', background: 'var(--bg-dark)', color: 'var(--text-on-dark)', fontSize: 14, borderRadius: 8, padding: '10px 12px', resize: 'none', border: '1px solid var(--border)', boxSizing: 'border-box', outline: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button
                onClick={submitReply}
                disabled={replying || !replyText.trim()}
                style={{ padding: '6px 18px', borderRadius: 20, background: 'linear-gradient(180deg, #334155 0%, #1e293b 100%)', color: '#e2e8f0', border: '1px solid #475569', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: replying || !replyText.trim() ? 0.4 : 1 }}
              >
                {replying ? 'Posting…' : 'Reply'}
              </button>
            </div>
          </div>
        )}

        {/* Replies */}
        {replies.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-on-dark)', marginBottom: 10, paddingLeft: 2 }}>
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {replies.map((rep: any, idx: number) => {
                const ra = rep.author;
                const raName = ra?.display_name || ra?.username || 'Unknown';
                const raUsername = ra?.username || '';
                const raPfp = ra?.pfp_url;
                let rTime = '';
                if (rep.timestamp) {
                  try {
                    const d = new Date(rep.timestamp);
                    if (!isNaN(d.getTime())) rTime = formatDistanceToNow(d, { addSuffix: true });
                  } catch {}
                }
                return (
                  <div key={rep.hash || idx} style={cardStyle}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {raPfp
                        ? <img src={raPfp} alt={raName} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 4 }}>
                          <Link href={`/profile?user=${raUsername}`} style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-on-dark)', textDecoration: 'none' }}>{raName}</Link>
                          <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>@{raUsername}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginLeft: 'auto' }}>{rTime}</span>
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-on-dark)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {renderCastText(rep.text || '')}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <ActionBtn
                            active={false}
                            onClick={() => setReplyingTo({ hash: rep.hash, fid: ra?.fid, name: raName })}
                            icon={
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                            }
                            label="Reply"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
