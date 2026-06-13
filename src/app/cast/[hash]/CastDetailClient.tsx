"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import SmartEmbed from "@/components/SmartEmbed";
import { useFarcasterWrites } from "@/hooks/useFarcasterWrites";

function ActionBtn({
  onClick, icon, label, active = false, disabled = false,
}: {
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
        color: active ? 'var(--text-on-dark, #fff)' : 'var(--muted-on-dark, #999)',
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

export default function CastDetailClient() {
  const params = useParams();
  const hash = params?.hash as string;
  const [cast, setCast] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction state
  const [likedCasts, setLikedCasts] = useState<Set<string>>(new Set());
  const [recastedCasts, setRecastedCasts] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showQuoteModal, setShowQuoteModal] = useState<{ hash: string; authorFid: number; preview: string } | null>(null);
  const [quoteText, setQuoteText] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const { hasActiveSigner, requestSigner, likeCast, unlikeCast, recast: recastFn, removeRecast, reply: replyFn, submitCast } = useFarcasterWrites();

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

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
    } catch (err: any) {
      console.error('Error fetching cast:', err);
      setError(err.message || 'Failed to load cast');
    }
  }, [hash]);

  useEffect(() => {
    if (!hash) { setError("No cast hash provided"); setLoading(false); return; }
    fetchCastDetail().finally(() => setLoading(false));
  }, [hash, fetchCastDetail]);

  const handleLike = async (castHash: string, authorFid: number) => {
    if (!hasActiveSigner) { await requestSigner(); return; }
    setActionLoading(`like-${castHash}`);
    try {
      if (likedCasts.has(castHash)) {
        await unlikeCast({ targetCastHash: castHash, targetCastFid: authorFid });
        setLikedCasts(prev => { const s = new Set(prev); s.delete(castHash); return s; });
      } else {
        await likeCast({ targetCastHash: castHash, targetCastFid: authorFid });
        setLikedCasts(prev => new Set([...prev, castHash]));
      }
    } catch (err: any) {
      showToast(`Failed to like: ${err?.message ?? 'error'}`, false);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecast = async (castHash: string, authorFid: number) => {
    if (!hasActiveSigner) { await requestSigner(); return; }
    setActionLoading(`recast-${castHash}`);
    try {
      if (recastedCasts.has(castHash)) {
        await removeRecast({ targetCastHash: castHash, targetCastFid: authorFid });
        setRecastedCasts(prev => { const s = new Set(prev); s.delete(castHash); return s; });
      } else {
        await recastFn({ targetCastHash: castHash, targetCastFid: authorFid });
        setRecastedCasts(prev => new Set([...prev, castHash]));
      }
    } catch (err: any) {
      showToast(`Failed to recast: ${err?.message ?? 'error'}`, false);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReply = async (castHash: string, authorFid: number) => {
    if (!hasActiveSigner) { await requestSigner(); return; }
    const text = replyText.trim();
    if (!text) return;
    setReplyText('');
    setReplyingTo(null);
    showToast('Sending reply…', true);
    try {
      await replyFn({ text, parentCastHash: castHash, parentCastFid: authorFid });
      showToast('Reply posted!', true);
    } catch (err: any) {
      showToast(`Failed: ${err?.message ?? 'error'}`, false);
    }
  };

  const handleQuoteCast = async () => {
    if (!showQuoteModal) return;
    if (!hasActiveSigner) { await requestSigner(); return; }
    if (!quoteText.trim()) return;
    setQuoteLoading(true);
    try {
      const castUrl = `https://warpcast.com/~/conversations/${showQuoteModal.hash}`;
      await submitCast({ text: quoteText, embeds: [{ url: castUrl }] });
      setQuoteText('');
      setShowQuoteModal(null);
      showToast('Quote cast posted!', true);
    } catch (err: any) {
      showToast(`Failed: ${err?.message ?? 'error'}`, false);
    } finally {
      setQuoteLoading(false);
    }
  };

  const renderActionRow = (castHash: string, authorFid: number, previewText: string) => (
    <div style={{
      display: 'flex', gap: 4, marginTop: 12, paddingTop: 12,
      borderTop: '1px solid rgba(255,255,255,0.08)',
      flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {/* Like */}
      <ActionBtn
        active={likedCasts.has(castHash)}
        disabled={actionLoading === `like-${castHash}`}
        onClick={() => handleLike(castHash, authorFid)}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill={likedCasts.has(castHash) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>}
        label={actionLoading === `like-${castHash}` ? '…' : 'Like'}
      />
      {/* Recast */}
      <ActionBtn
        active={recastedCasts.has(castHash)}
        disabled={actionLoading === `recast-${castHash}`}
        onClick={() => handleRecast(castHash, authorFid)}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>}
        label={actionLoading === `recast-${castHash}` ? '…' : recastedCasts.has(castHash) ? 'Recasted' : 'Recast'}
      />
      {/* Quote */}
      <ActionBtn
        onClick={() => setShowQuoteModal({ hash: castHash, authorFid, preview: previewText })}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>}
        label="Quote"
      />
      {/* Reply */}
      <ActionBtn
        active={replyingTo === castHash}
        onClick={() => setReplyingTo(replyingTo === castHash ? null : castHash)}
        icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
        label="Reply"
      />
    </div>
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted-on-dark, #999)' }}>Loading cast…</div>
      </div>
    );
  }

  if (error || !cast) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>😔</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Cast Not Found</div>
          <div style={{ color: 'var(--muted-on-dark, #999)', marginBottom: 24 }}>{error || 'Unable to load this cast'}</div>
          <Link href="/feed" style={{ color: 'var(--muted-on-dark, #999)' }}>← Back to Feed</Link>
        </div>
      </div>
    );
  }

  const author = cast.author;
  const authorName = author?.display_name || author?.username || 'Unknown';
  const authorUsername = author?.username || '';
  const authorFid = author?.fid ?? 0;
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

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))',
          left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? 'rgba(30,30,30,0.95)' : 'rgba(180,30,30,0.95)',
          color: '#fff', padding: '10px 20px', borderRadius: 24,
          fontSize: 14, fontWeight: 500, zIndex: 20000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
        {/* Back */}
        <Link
          href="/feed"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted-on-dark, #999)', textDecoration: 'none', marginBottom: 20, fontSize: 14 }}
        >
          ← Back
        </Link>

        {/* Parent thread context */}
        {parentChain.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {parentChain.map((p: any, idx: number) => {
              const pAuthor = p.author;
              const pName = pAuthor?.display_name || pAuthor?.username || 'Unknown';
              const pUsername = pAuthor?.username || '';
              const pPfp = pAuthor?.pfp_url;
              const pText = p.text || '';
              let pTime = '';
              try { const d = new Date(p.timestamp); if (!isNaN(d.getTime())) pTime = formatDistanceToNow(d, { addSuffix: true }); } catch {}
              return (
                <div key={p.hash || idx} style={{ position: 'relative' }}>
                  <div className="surface" style={{ marginBottom: 0, borderBottom: 'none', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, opacity: 0.75 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        {pPfp ? (
                          <Link href={`/profile?user=${pUsername}`}>
                            <Image src={pPfp} alt={pName} width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                          </Link>
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)' }} />
                        )}
                        {/* Thread line */}
                        <div style={{ width: 2, flex: 1, minHeight: 16, background: 'rgba(255,255,255,0.15)', marginTop: 4 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 4 }}>
                          <Link href={`/profile?user=${pUsername}`} style={{ fontWeight: 700, textDecoration: 'none', color: 'inherit', fontSize: 13 }}>{pName}</Link>
                          <span style={{ fontSize: 12, color: 'var(--muted-on-dark, #999)' }}>· {pTime}</span>
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-on-dark, #eee)' }}>{pText}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Main Cast */}
        <div className="surface" style={{ marginBottom: 20, ...(parentChain.length > 0 ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : {}) }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
            {authorPfp && (
              <Link href={`/profile?user=${authorUsername}`}>
                <Image src={authorPfp} alt={authorName} width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              </Link>
            )}
            <div>
              <Link href={`/profile?user=${authorUsername}`} style={{ fontWeight: 700, textDecoration: 'none', color: 'inherit', display: 'block' }}>
                {authorName}
              </Link>
              <div style={{ fontSize: 13, color: 'var(--muted-on-dark, #999)' }}>@{authorUsername}</div>
            </div>
          </div>

          <div style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {text}
          </div>

          {embeds.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
              {embeds.map((embed: any, idx: number) => {
                if (!embed.url) return null;
                const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(embed.url) || /imagedelivery\.net|imgur\.com/i.test(embed.url);
                if (isImage) return <img key={idx} src={embed.url} alt="embed" style={{ maxWidth: '100%', borderRadius: 8 }} />;
                return <SmartEmbed key={idx} url={embed.url} castHash={cast.hash} />;
              })}
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--muted-on-dark, #999)', marginBottom: 4 }}>
            <span>{cast.reactions?.likes_count ?? cast.reactions?.likes?.length ?? 0} likes</span>
            <span>{cast.reactions?.recasts_count ?? cast.reactions?.recasts?.length ?? 0} recasts</span>
            <span>{cast.replies?.count ?? 0} replies</span>
            <span style={{ marginLeft: 'auto' }}>{timeLabel}</span>
          </div>

          {/* Action buttons */}
          {renderActionRow(cast.hash, authorFid, text)}

          {/* Reply input for main cast */}
          {replyingTo === cast.hash && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <textarea
                className="compose-textarea"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={`Replying to @${authorUsername}…`}
                autoFocus
                style={{ minHeight: 80, fontSize: 14, width: '100%' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => { setReplyingTo(null); setReplyText(''); }}>Cancel</button>
                <button className="btn primary" onClick={() => handleReply(cast.hash, authorFid)} disabled={!replyText.trim()}>Post Reply</button>
              </div>
            </div>
          )}
        </div>

        {/* Replies */}
        {replies.length > 0 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Replies ({replies.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {replies.map((reply: any, idx: number) => {
                const rAuthor = reply.author;
                const rName = rAuthor?.display_name || rAuthor?.username || 'Unknown';
                const rUsername = rAuthor?.username || '';
                const rFid = rAuthor?.fid ?? 0;
                const rPfp = rAuthor?.pfp_url;
                const rText = reply.text || '';
                let rTime = '';
                if (reply.timestamp) {
                  try {
                    const d = new Date(reply.timestamp);
                    if (!isNaN(d.getTime())) rTime = formatDistanceToNow(d, { addSuffix: true });
                  } catch {}
                }

                return (
                  <div key={reply.hash || idx} className="surface">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                      {rPfp && (
                        <Link href={`/profile?user=${rUsername}`}>
                          <Image src={rPfp} alt={rName} width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        </Link>
                      )}
                      <div>
                        <Link href={`/profile?user=${rUsername}`} style={{ fontWeight: 700, textDecoration: 'none', color: 'inherit', fontSize: 14 }}>
                          {rName}
                        </Link>
                        <div style={{ fontSize: 12, color: 'var(--muted-on-dark, #999)' }}>@{rUsername} · {rTime}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 4 }}>
                      {rText}
                    </div>

                    {/* Action buttons on each reply */}
                    {renderActionRow(reply.hash, rFid, rText)}

                    {/* Reply input for this reply */}
                    {replyingTo === reply.hash && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <textarea
                          className="compose-textarea"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder={`Replying to @${rUsername}…`}
                          autoFocus
                          style={{ minHeight: 72, fontSize: 14, width: '100%' }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                          <button className="btn" onClick={() => { setReplyingTo(null); setReplyText(''); }}>Cancel</button>
                          <button className="btn primary" onClick={() => handleReply(reply.hash, rFid)} disabled={!replyText.trim()}>Post Reply</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quote Cast Modal */}
      {showQuoteModal && (
        <div
          onClick={() => setShowQuoteModal(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 9000, padding: '0 0 env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface, #1a1a1a)', borderRadius: '16px 16px 0 0',
              padding: '24px 20px', width: '100%', maxWidth: 600,
              maxHeight: '80vh', overflow: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: 17, fontWeight: 600 }}>Quote Cast</h3>
            {/* Preview */}
            <div style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 14,
              fontSize: 13, color: 'var(--muted-on-dark, #999)',
              maxHeight: 80, overflow: 'hidden',
            }}>
              {showQuoteModal.preview.slice(0, 200)}{showQuoteModal.preview.length > 200 ? '…' : ''}
            </div>
            <textarea
              className="compose-textarea"
              value={quoteText}
              onChange={e => setQuoteText(e.target.value)}
              placeholder="Add your thoughts…"
              autoFocus
              style={{ minHeight: 100, fontSize: 15, width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => { setShowQuoteModal(null); setQuoteText(''); }}>Cancel</button>
              <button
                className="btn primary"
                onClick={handleQuoteCast}
                disabled={quoteLoading || !quoteText.trim()}
              >
                {quoteLoading ? 'Posting…' : 'Post Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
