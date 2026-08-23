"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import dynamic from 'next/dynamic';
import UrlPreview from './UrlPreview';
import EmbedRenderer, { findFarcasterCastUrls, parseFarcasterCastUrl } from './EmbedRenderer';
import FarcasterCastEmbed from './FarcasterCastEmbed';
import ParentCastBadge from './ParentCastBadge';
import { fetchFeed } from "../lib/farcaster";
import { FeedSkeleton } from "./Skeletons";
import { formatDistanceToNow } from "date-fns";
import { FeedType } from "./FeedTrendingTabs";
import { useFarcasterWrites } from "@/hooks/useFarcasterWrites";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Heavy markdown libs loaded lazily — not needed until a cast with markdown renders
const LazyMarkdown = dynamic(
  async () => {
    const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
      import('react-markdown'),
      import('remark-gfm'),
    ]);
    const Md = ({ children, components }: { children: string; components?: any }) => (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown>
    );
    Md.displayName = 'LazyMarkdown';
    return Md;
  },
  { ssr: false }
);

// Module-level helpers — defined once, never recreated
function getUserInterests(): string[] {
  try {
    const stored = localStorage.getItem('hh_feed_interests');
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function scoreCast(cast: any, interests: string[]): number {
  if (!interests.length) return 0;
  const text = (cast.text || '').toLowerCase();
  const channelId = cast.channel?.id?.toLowerCase() || '';
  let score = 0;
  for (const interest of interests) {
    const li = interest.toLowerCase();
    if (text.includes(li)) score += 10;
    if (channelId === li) score += 15;
    const hashtags = text.match(/#\w+/g) || [];
    if (hashtags.some((tag: string) => tag.toLowerCase().includes(li))) score += 12;
  }
  return score;
}

function renderCastText(text: string) {
  const tokenOrUrl = /(\$[A-Z][A-Z0-9]{0,9}|https?:\/\/[^\s]+|(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|io|lol|xyz|app|dev|co|ai|eth|fyi|gg|wtf|us|uk)[^\s]*)/g;
  const parts = text.split(tokenOrUrl);
  return parts.map((part, i) => {
    if (/^\$[A-Z][A-Z0-9]{0,9}$/.test(part)) {
      return (
        <Link key={i} href={`/tokens/${encodeURIComponent(part.slice(1))}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }} onClick={e => e.stopPropagation()}>
          {part}
        </Link>
      );
    }
    if (/^https?:\/\//i.test(part) || /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/.test(part)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

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
        color: active ? 'var(--text-on-dark)' : 'var(--muted-on-dark)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 13, fontWeight: active ? 600 : 400,
        padding: '5px 9px', borderRadius: 8,
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0, whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
          e.currentTarget.style.color = 'var(--text-on-dark)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = active ? 'rgba(255,255,255,0.08)' : 'transparent';
        e.currentTarget.style.color = active ? 'var(--text-on-dark)' : 'var(--muted-on-dark)';
      }}
    >
      {icon}
      {label}
    </button>
  );
}

interface FeedListProps {
  feedType: FeedType;
  selectedChannel: string | null;
  mutedUsers: Set<string>;
  hiddenCasts: Set<string>;
  onMuteUser: (username: string) => void;
  onHideCast: (hash: string) => void;
}

export default function FeedList({ 
  feedType, 
  selectedChannel, 
  mutedUsers, 
  hiddenCasts,
  onMuteUser,
  onHideCast
}: FeedListProps) {
  const [items, setItems] = useState<any[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pullDist, setPullDist] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartYRef = useRef(0);
  const PULL_THRESHOLD = 72;
  const [showActions, setShowActions] = useState<string | null>(null);
  const [likedCasts, setLikedCasts] = useState<Set<string>>(new Set());
  const [recastedCasts, setRecastedCasts] = useState<Set<string>>(new Set());
  const [quotedCasts, setQuotedCasts] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [showRecastModal, setShowRecastModal] = useState<string | null>(null);
  const [showRecastAuthorFid, setShowRecastAuthorFid] = useState<number>(0);
  const [showQuoteModal, setShowQuoteModal] = useState<string | null>(null);
  const [quoteText, setQuoteText] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [seeLessAuthors, setSeeLessAuthors] = useState<Set<string>>(new Set());
  const [curatingCast, setCuratingCast] = useState<string | null>(null);
  const [curateListName, setCurateListName] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [curateLoading, setCurateLoading] = useState(false);
  const [savedNotes, setSavedNotes] = useState<Set<string>>(new Set());

  const manualRefreshRef = useRef(false);

  const router = useRouter();
  const { hasActiveSigner, requestSigner, submitCast, likeCast, unlikeCast, recast: recastFn, removeRecast, reply: replyFn } = useFarcasterWrites();

  // Get profile from localStorage
  const getProfile = () => {
    const storedProfile = localStorage.getItem("hh_profile");
    if (!storedProfile) return null;
    try {
      return JSON.parse(storedProfile);
    } catch {
      return null;
    }
  };

  const handleLike = async (castHash: string, authorFid: number) => {
    if (!hasActiveSigner) { await requestSigner(); return; }
    setActionLoading(`like-${castHash}`);
    try {
      if (likedCasts.has(castHash)) {
        await unlikeCast({ targetCastHash: castHash, targetCastFid: authorFid });
        setLikedCasts(prev => { const next = new Set(prev); next.delete(castHash); return next; });
      } else {
        await likeCast({ targetCastHash: castHash, targetCastFid: authorFid });
        setLikedCasts(prev => new Set([...prev, castHash]));
      }
    } catch (error: any) {
      console.error('Like error:', error);
      alert(`Failed to like: ${error?.message ?? error}`);
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
        setRecastedCasts(prev => { const next = new Set(prev); next.delete(castHash); return next; });
      } else {
        await recastFn({ targetCastHash: castHash, targetCastFid: authorFid });
        setRecastedCasts(prev => new Set([...prev, castHash]));
      }
    } catch (error: any) {
      console.error('Recast error:', error);
      alert(`Failed to recast: ${error?.message ?? error}`);
    } finally {
      setActionLoading(null);
    }
  };

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleReply = async (castHash: string, authorFid: number) => {
    if (!hasActiveSigner) { await requestSigner(); return; }
    const text = replyText.trim();
    if (!text) return;

    // Optimistic dismiss — close the form immediately so the user isn't waiting
    setReplyText('');
    setReplyingTo(null);
    showToast('Sending reply…', true);

    try {
      await replyFn({ text, parentCastHash: castHash, parentCastFid: authorFid });
      showToast('Reply posted!', true);
    } catch (error: any) {
      console.error('Reply error:', error);
      showToast(`Failed: ${error?.message ?? 'unknown error'}`, false);
    }
  };

  const handleCurateCast = async (castHash: string, castData: any) => {
    const profile = getProfile();
    if (!profile?.fid) {
      alert("Please sign in to curate casts");
      return;
    }

    if (!curateListName.trim()) {
      alert("Please enter a list name");
      return;
    }

    setCurateLoading(true);
    try {
      const res = await fetch("/api/curate-cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: profile.fid,
          listName: curateListName.trim(),
          castHash,
          castData: {
            authorFid: castData.authorFid,
            text: castData.text,
            timestamp: castData.timestamp
          }
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.alreadyAdded ? `Already in "${curateListName}"` : `✅ ${data.message}`);
        setCurateListName("");
        setCuratingCast(null);
      } else {
        alert(`Failed to curate: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Curate error:", error);
      alert("Failed to curate cast");
    } finally {
      setCurateLoading(false);
    }
  };

  const handleQuoteCast = async (castHash: string) => {
    if (!hasActiveSigner) { await requestSigner(); return; }
    if (!quoteText.trim()) { alert('Please add some text to your quote cast'); return; }
    setQuoteLoading(true);
    try {
      const quotedCastUrl = `https://warpcast.com/~/conversations/${castHash}`;
      await submitCast({ text: quoteText, embeds: [{ url: quotedCastUrl }] });
      setQuoteText('');
      setShowQuoteModal(null);
      setQuotedCasts(prev => new Set([...prev, castHash]));
      alert('Quote cast posted!');
    } catch (error: any) {
      console.error('Quote cast error:', error);
      alert(`Failed to post quote cast: ${error?.message ?? error}`);
    } finally {
      setQuoteLoading(false);
    }
  };

  // Load see less preferences on mount
  useEffect(() => {
    const stored = localStorage.getItem('hh_see_less');
    if (stored) {
      try {
        const authors = JSON.parse(stored);
        setSeeLessAuthors(new Set(authors));
      } catch (e) {}
    }
  }, []);

  // Signer approval handled natively via Ed25519 — no polling needed

  useEffect(() => {
    let mounted = true;
    const cacheKey = `hh_feed_${feedType}_${selectedChannel ?? 'all'}`;
    const isManualRefresh = manualRefreshRef.current;
    manualRefreshRef.current = false;

    // Reset pagination cursors
    setCursor(null);
    setHasMore(true);

    // Restore from sessionStorage cache immediately (skip skeleton) unless pull-to-refresh
    if (!isManualRefresh) {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const { items: ci, cursor: cc, ts } = JSON.parse(raw);
          if (Array.isArray(ci) && Date.now() - (ts ?? 0) < 5 * 60 * 1000) {
            setItems(ci);
            setCursor(cc ?? null);
            setHasMore(!!cc);
          } else {
            setItems(null);
          }
        } else {
          setItems(null);
        }
      } catch {
        setItems(null);
      }
    }

    (async () => {
      let res;
      let nextCursor: string | null = null;
      try {
        // Get FID from localStorage since auth-kit profile doesn't include it
        let fid: number | undefined = undefined;
        try {
          const storedProfile = localStorage.getItem("hh_profile");
          if (storedProfile) {
            const parsed = JSON.parse(storedProfile);
            fid = parsed?.fid;
          }
        } catch (e) {
          console.error('[FeedList] Error reading FID from localStorage:', e);
        }

        getProfile();

        // Build query params based on feed type and channel
        let url = `/api/feed?feed_type=${feedType}`;
        if (fid) url += `&fid=${encodeURIComponent(String(fid))}`;
        if (selectedChannel) url += `&channel=${encodeURIComponent(selectedChannel)}`;

        const feedRes = await fetch(url);

        if (feedRes.ok) {
          const json = await feedRes.json();
          res = json?.data ?? json;
          nextCursor = json?.cursor || null;
        } else {
          res = await fetchFeed(20);
        }
      } catch (e) {
        console.error('[FeedList] Error fetching feed:', e);
        res = await fetchFeed(20);
      }

      if (mounted) {
        setItems(res);
        setCursor(nextCursor);
        setHasMore(!!nextCursor);
        // Cache for instant restore on next navigation
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            items: Array.isArray(res) ? res.slice(0, 60) : res,
            cursor: nextCursor,
            ts: Date.now(),
          }));
        } catch {}
      }
    })();
    return () => {
      mounted = false;
    };
  }, [feedType, selectedChannel, refreshKey]);

  // loadMore: fetch next page and append
  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      let fid: number | undefined = undefined;
      try {
        const storedProfile = localStorage.getItem("hh_profile");
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          fid = parsed?.fid;
        }
      } catch (e) {}

      let url = `/api/feed?feed_type=${feedType}&cursor=${encodeURIComponent(cursor)}`;
      if (fid) url += `&fid=${encodeURIComponent(String(fid))}`;
      if (selectedChannel) url += `&channel=${encodeURIComponent(selectedChannel)}`;

      const feedRes = await fetch(url);
      if (feedRes.ok) {
        const json = await feedRes.json();
        const newItems = json?.data ?? json;
        const nextCursor = json?.cursor || null;
        if (Array.isArray(newItems)) {
          setItems(prev => [...(prev ?? []), ...newItems]);
        }
        setCursor(nextCursor);
        setHasMore(!!nextCursor);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error('[FeedList] loadMore error:', e);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  // IntersectionObserver for infinite scroll sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMore();
      }
    }, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadingMore, cursor]);

  // Must be before any early returns — hooks can't be called conditionally
  const filteredItems = useMemo(() => {
    const interests = getUserInterests();
    let result = (items || []).filter((it, index) => {
      const authorObj = it.author && typeof it.author === 'object' ? it.author : null;
      const rawUser = authorObj?.username || (typeof it.author === 'string' ? it.author : null) || it.handle || null;
      const authorUsername = rawUser && /^fid:\d+$/i.test(rawUser) ? null : rawUser;
      const castHash = it.hash || it.id;
      if (authorUsername && mutedUsers.has(authorUsername)) return false;
      if (castHash && hiddenCasts.has(castHash)) return false;
      if (authorUsername && seeLessAuthors.has(authorUsername)) return index % 4 === 0;
      return true;
    });
    if (interests.length > 0) {
      result = result
        .map(cast => ({ ...cast, _interestScore: scoreCast(cast, interests) }))
        .sort((a, b) => b._interestScore - a._interestScore);
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, mutedUsers, hiddenCasts, seeLessAuthors]);

  if (items === null)
    return (
      <div aria-busy="true" aria-live="polite">
        <FeedSkeleton count={3} />
      </div>
    );
  if (!items.length) return (
    <div className="surface" style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted-on-dark)' }}>
      {selectedChannel
        ? `No casts found in #${selectedChannel}.`
        : feedType === 'following'
        ? 'No casts to show yet. Follow people on Farcaster to populate your feed.'
        : 'No casts available right now. Pull down to refresh or try again shortly.'}
    </div>
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0) touchStartYRef.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY > 0) { setPullDist(0); return; }
    const dist = e.touches[0].clientY - touchStartYRef.current;
    if (dist > 0) setPullDist(Math.min(dist, PULL_THRESHOLD * 1.5));
  };
  const handleTouchEnd = () => {
    if (pullDist >= PULL_THRESHOLD) {
      manualRefreshRef.current = true;
      setIsRefreshing(true);
      setItems(null);
      setRefreshKey(k => k + 1);
      setTimeout(() => { setIsRefreshing(false); }, 800);
    }
    setPullDist(0);
  };

  return (
    <>
    {/* Non-blocking toast for reply/post feedback */}
    {toast && (
      <div
        onClick={() => { if (toast.msg === 'Saved to Notes') router.push('/notes'); }}
        style={{
          position: 'fixed', bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))',
          left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? 'rgba(30,30,30,0.95)' : 'rgba(180,30,30,0.95)',
          color: '#fff', padding: '10px 20px', borderRadius: 24,
          fontSize: 14, fontWeight: 500, zIndex: 20000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'hhFadeIn 0.15s ease-out',
          whiteSpace: 'nowrap',
          cursor: toast.msg === 'Saved to Notes' ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {toast.msg}
        {toast.msg === 'Saved to Notes' && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </div>
    )}
    <style>{`@keyframes ptr-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    {/* Pull-to-refresh indicator */}
    <div style={{
      overflow: 'hidden',
      height: isRefreshing ? 48 : Math.max(0, pullDist * 0.45),
      transition: pullDist === 0 ? 'height 0.3s ease' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        border: '2.5px solid var(--accent)',
        borderTopColor: 'transparent',
        transform: isRefreshing ? undefined : `rotate(${pullDist * 3}deg)`,
        animation: isRefreshing ? 'ptr-spin 0.7s linear infinite' : 'none',
        opacity: Math.min(1, pullDist / PULL_THRESHOLD),
      }} />
    </div>
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="space-y-4"
    >
      {filteredItems.map((it) => {
        const rawTs = it.timestamp ?? it.ts ?? it.time ?? null;
        const authorObj = it.author && typeof it.author === 'object' ? it.author : null;
        const rawUsername = authorObj?.username || (typeof it.author === 'string' ? it.author : null) || it.handle || null;
        // Don't show raw FID strings like "fid:234616" as a username
        const authorUsername = rawUsername && /^fid:\d+$/i.test(rawUsername) ? null : rawUsername;
        const authorFid = authorObj?.fid ?? null;
        // Navigate by username when available; fall back to FID so profile loads cleanly
        const profileHref = authorUsername
          ? `/profile?user=${authorUsername}`
          : authorFid
            ? `/profile?fid=${authorFid}`
            : '/feed';
        const authorName = authorObj?.display_name || authorUsername || 'Unknown';
        const text = typeof it.text === 'string' ? it.text : (it.body ?? (typeof it.message === 'string' ? it.message : null)) ?? JSON.stringify(it);
        const key = it.hash || it.id || JSON.stringify({ h: it.hash, t: rawTs, a: authorName }).slice(0, 64);
        let timeLabel = "";
        if (rawTs) {
          try {
            let date: Date;
            if (typeof rawTs === 'number') {
              // seconds? milliseconds?
              date = new Date(rawTs > 1e12 ? rawTs : rawTs * 1000);
            } else {
              date = new Date(String(rawTs));
            }
            if (!isNaN(date.getTime())) {
              timeLabel = formatDistanceToNow(date, { addSuffix: true });
            } else {
              timeLabel = String(rawTs);
            }
          } catch (e) {
            timeLabel = String(rawTs);
          }
        }

        // If the body is nothing but Farcaster cast link(s), skip the raw-URL text
        // and let the quote-cast embed(s) below stand in for it.
        const allUrlsInText = text.match(/https?:\/\/[^\s]+/gi) ?? [];
        const fcCastUrlsInText = findFarcasterCastUrls(text);
        const textIsOnlyFcCastUrls =
          fcCastUrlsInText.length > 0 &&
          allUrlsInText.length === fcCastUrlsInText.length &&
          text.replace(/https?:\/\/[^\s]+/gi, '').trim() === '';

        return (
          <article key={key} className="surface" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '4px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'start', flex: 1 }}>
                <Link href={profileHref}>
                  <img
                    src={authorObj?.pfp_url || '/default-avatar.png'}
                    alt={authorName}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"%3E%3Crect fill="%23555" width="40" height="40"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="20" fill="%23fff"%3E?%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', flexWrap: 'wrap', minWidth: 0 }}>
                    <Link
                      href={profileHref}
                      style={{
                        fontWeight: 700,
                        textDecoration: 'none',
                        color: 'inherit',
                        whiteSpace: 'nowrap'
                      }}
                      className="hover:text-white dark:hover:text-zinc-200 transition-colors"
                    >
                      {authorName}
                    </Link>
                    {authorUsername && (
                      <Link
                        href={profileHref}
                        style={{
                          fontSize: '13px',
                          color: 'var(--muted-on-dark)',
                          textDecoration: 'none',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        @{authorUsername}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowActions(showActions === key ? null : key)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted-on-dark)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '0 8px',
                  flexShrink: 0
                }}
              >
                ⋯
              </button>
            </div>
            {showActions === key && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'var(--bg-dark)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                <button
                  onClick={() => {
                    if (authorUsername) {
                      setSeeLessAuthors(prev => new Set([...prev, authorUsername]));
                      localStorage.setItem('hh_see_less', JSON.stringify([...seeLessAuthors, authorUsername]));
                    }
                    setShowActions(null);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  👎 See less of this
                </button>
                <button
                  onClick={() => {
                    onHideCast(key);
                    setShowActions(null);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Hide this cast
                </button>
                {authorUsername && (
                  <button
                    onClick={() => {
                      onMuteUser(authorUsername);
                      setShowActions(null);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--foreground)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Mute @{authorUsername}
                  </button>
                )}
              </div>
            )}
            {it.parent_hash && (
              <ParentCastBadge parentHash={it.parent_hash} />
            )}
            {!textIsOnlyFcCastUrls && (
            <div
              onClick={() => router.push(`/cast/${key}`)}
              style={{
                marginTop: 2,
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                cursor: 'pointer',
              }}
            >
              <LazyMarkdown
                components={{
                  a: ({ node: _node, href, ...props }: any) => (
                    <a
                      {...props}
                      href={href}
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        // Open via window.open — plain target="_blank" navigation is
                        // blocked inside the Farcaster mini-app webview.
                        e.preventDefault();
                        e.stopPropagation();
                        if (href) {
                          try { window.open(href, '_blank', 'noopener,noreferrer'); }
                          catch { window.location.href = href; }
                        }
                      }}
                      style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}
                    />
                  ),
                  code: ({ node, inline, ...props }: any) =>
                    inline ?
                      <code {...props} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '3px', fontSize: '0.9em' }} /> :
                      <code {...props} style={{ display: 'block', background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '6px', overflowX: 'auto', fontSize: '0.9em', margin: '8px 0' }} />
                }}
              >
                {text}
              </LazyMarkdown>            </div>
            )}

            {/* Display embeds (images, videos, links, etc.) */}
            {Array.isArray(it.embeds) && it.embeds.length > 0 && (
              <>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {it.embeds.map((embed: any, idx: number) => (
                    <EmbedRenderer key={idx} embed={embed} index={idx} />
                  ))}
                </div>
              </>
            )}

            {/* Farcaster cast links that live only in the text (not in embeds) →
                render them as quote-cast cards too, deduped against the embeds. */}
            {(() => {
              const embedHashes = new Set(
                (Array.isArray(it.embeds) ? it.embeds : [])
                  .map((e: any) => parseFarcasterCastUrl((typeof e === 'string' ? e : e?.url) || '')?.hash?.toLowerCase())
                  .filter(Boolean)
              );
              const textCasts = findFarcasterCastUrls(text).filter(
                (c) => !embedHashes.has(c.hash.toLowerCase())
              );
              if (!textCasts.length) return null;
              return (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {textCasts.map((c, idx) => (
                    <FarcasterCastEmbed key={`txt-${idx}`} hash={c.hash} username={c.username} originalUrl={c.url} />
                  ))}
                </div>
              );
            })()}
            
            <div style={{ 
              marginTop: 8, 
              fontSize: 12, 
              color: 'var(--muted-on-dark)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>
                <Link
                  href={`/cast/${key}`}
                  style={{ color: 'var(--muted-on-dark)', textDecoration: 'none' }}
                  className="hover:underline"
                >
                  {timeLabel}
                </Link>
                {it.channel?.id && (
                  <Link
                    href={`/channel/${it.channel.id}`}
                    style={{
                      marginLeft: '8px',
                      color: 'var(--accent)',
                      textDecoration: 'none'
                    }}
                    className="hover:underline"
                  >
                    /{it.channel.id}
                  </Link>
                )}
              </span>
            </div>
            
            {/* Action buttons */}
            <div style={{
              display: 'flex',
              gap: '4px',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border)',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}>
              {/* Like */}
              <ActionBtn
                active={likedCasts.has(key)}
                disabled={actionLoading === `like-${key}`}
                onClick={() => handleLike(key, authorObj?.fid ?? 0)}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={likedCasts.has(key) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                }
                label={actionLoading === `like-${key}` ? '…' : 'Like'}
              />

              {/* Recast */}
              <ActionBtn
                active={recastedCasts.has(key)}
                disabled={actionLoading === `recast-${key}`}
                onClick={() => { setShowRecastModal(key); setShowRecastAuthorFid(authorObj?.fid ?? 0); }}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                }
                label={actionLoading === `recast-${key}` ? '…' : recastedCasts.has(key) ? 'Recasted' : 'Recast'}
              />

              {/* Quote */}
              <ActionBtn
                onClick={() => { setShowQuoteModal(key); }}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
                }
                label="Quote"
              />

              {/* Reply */}
              <ActionBtn
                active={replyingTo === key}
                onClick={() => setReplyingTo(replyingTo === key ? null : key)}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                }
                label="Reply"
              />

              {/* Curate */}
              <ActionBtn
                active={curatingCast === key}
                onClick={() => setCuratingCast(curatingCast === key ? null : key)}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={curatingCast === key ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                }
                label="Curate"
              />

              {/* Ask Homie */}
              <ActionBtn
                onClick={() => {
                  const castText = typeof it.text === 'string' ? it.text : (it.body ?? (typeof it.message === 'string' ? it.message : ''));
                  const castData = encodeURIComponent(JSON.stringify({
                    author: { username: authorUsername, display_name: authorName, pfp_url: authorObj?.pfp_url },
                    text: castText,
                    hash: key,
                    timestamp: rawTs,
                    reactions: { likes_count: it.reactions?.likes_count || 0, recasts_count: it.reactions?.recasts_count || 0 },
                    replies: { count: it.replies?.count || 0 }
                  }));
                  window.location.href = `/ask-homie?cast=${castData}`;
                }}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                }
                label="Ask Homie"
              />

              {/* Save to Notes */}
              <ActionBtn
                active={savedNotes.has(key)}
                onClick={() => {
                  const castText = typeof it.text === 'string' ? it.text : (it.body ?? '');
                  try {
                    const raw = localStorage.getItem('hh_notes');
                    const notes = raw ? JSON.parse(raw) : [];
                    const note = {
                      id: Date.now().toString(),
                      title: `@${authorUsername}`,
                      content: castText,
                      tags: ['saved-cast', ...(it.channel?.id ? [it.channel.id] : [])],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      source: key,
                    };
                    localStorage.setItem('hh_notes', JSON.stringify([note, ...notes]));
                    setSavedNotes(prev => new Set([...prev, key]));
                    showToast('Saved to Notes', true);
                    setTimeout(() => setSavedNotes(prev => { const n = new Set(prev); n.delete(key); return n; }), 2500);
                  } catch {}
                }}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={savedNotes.has(key) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                }
                label={savedNotes.has(key) ? 'Saved!' : 'Save'}
              />
            </div>
            
            {/* Reply input */}
            {replyingTo === key && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <textarea
                  className="compose-textarea"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write your reply..."
                  autoFocus
                  style={{ minHeight: '80px', fontSize: '14px' }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn" 
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText("");
                    }}
                    disabled={replyLoading}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => handleReply(key, authorObj?.fid ?? 0)}
                    disabled={!replyText.trim()}
                  >
                    Post Reply
                  </button>
                </div>
              </div>
            )}

            {curatingCast === key && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <input
                  type="text"
                  value={curateListName}
                  onChange={(e) => setCurateListName(e.target.value)}
                  placeholder="Enter list name (e.g., 'Favorite Crypto Takes')"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && curateListName.trim()) {
                      handleCurateCast(key, {
                        authorFid: authorObj?.fid,
                        text: typeof it.text === 'string' ? it.text : (it.body ?? ''),
                        timestamp: rawTs
                      });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--foreground)',
                    marginBottom: '8px'
                  }}
                />
                <p style={{ fontSize: '12px', color: 'var(--muted-on-dark)', marginBottom: '12px' }}>
                  Add this cast to a new or existing list. Lists help you organize great content.
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn" 
                    onClick={() => {
                      setCuratingCast(null);
                      setCurateListName("");
                    }}
                    disabled={curateLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn primary" 
                    onClick={() => handleCurateCast(key, {
                      authorFid: authorObj?.fid,
                      text: typeof it.text === 'string' ? it.text : (it.body ?? ''),
                      timestamp: rawTs
                    })}
                    disabled={curateLoading || !curateListName.trim()}
                  >
                    {curateLoading ? "Adding..." : "Add to List"}
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}

      {/* Signer approval handled by Farcaster auth — no modal needed */}

      {/* Recast Modal */}
      {showRecastModal && (
        <div 
          onClick={() => setShowRecastModal(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--background)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              Cast Options
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Quote Cast */}
              <button
                onClick={() => {
                  const castHash = showRecastModal;
                  setShowRecastModal(null);
                  setShowQuoteModal(castHash);
                }}
                className="btn"
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                💬 Quote Cast
              </button>

              {/* Recast or Undo Recast */}
              {recastedCasts.has(showRecastModal) ? (
                <button
                  onClick={async () => {
                    await handleRecast(showRecastModal, showRecastAuthorFid);
                    setShowRecastModal(null);
                  }}
                  className="btn"
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444'
                  }}
                >
                  ↩️ Undo Recast
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await handleRecast(showRecastModal, showRecastAuthorFid);
                    setShowRecastModal(null);
                  }}
                  className="btn primary"
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  🔄 Recast
                </button>
              )}

              {/* Reply */}
              <button
                onClick={() => {
                  setShowRecastModal(null);
                  setReplyingTo(showRecastModal);
                }}
                className="btn"
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                💬 Reply
              </button>
              
              <button
                onClick={() => setShowRecastModal(null)}
                className="btn"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  opacity: 0.7
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Cast Modal */}
      {showQuoteModal && (
        <div
          onClick={() => setShowQuoteModal(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>Quote Cast</h3>
            
            {/* Cast Preview */}
            {(() => {
              const cast = items?.find(item => item.hash === showQuoteModal);
              if (cast) {
                return (
                  <div style={{
                    background: '#1a1a1a',
                    border: '2px solid #333',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      {cast.author?.pfp_url && (
                        <img
                          src={cast.author.pfp_url}
                          alt={cast.author.username || 'user'}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            objectFit: 'cover'
                          }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '15px', color: '#fff' }}>
                          {cast.author?.display_name || cast.author?.username || 'Unknown'}
                        </div>
                        <div style={{ color: '#999', fontSize: '13px' }}>@{cast.author?.username || 'unknown'}</div>
                      </div>
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: '15px',
                      lineHeight: '1.5',
                      color: '#e0e0e0',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {renderCastText(cast.text || '(No text)')}
                    </p>
                    {cast.embeds && cast.embeds.length > 0 && cast.embeds[0]?.url && (
                      <div style={{ marginTop: '12px' }}>
                        {cast.embeds[0].url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img 
                            src={cast.embeds[0].url} 
                            alt="embed"
                            style={{ 
                              maxWidth: '100%', 
                              borderRadius: '8px',
                              maxHeight: '200px',
                              objectFit: 'cover'
                            }} 
                          />
                        ) : (
                          <div style={{ 
                            fontSize: '13px', 
                            color: '#888',
                            fontStyle: 'italic'
                          }}>
                            🔗 {cast.embeds[0].url.substring(0, 50)}...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}
            
            <textarea
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value)}
              placeholder="Add your thoughts..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px',
                fontSize: '15px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--background)',
                color: 'var(--text)',
                resize: 'vertical',
                marginBottom: '16px',
                fontFamily: 'inherit'
              }}
              autoFocus
            />
            
            <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
              <button
                onClick={() => handleQuoteCast(showQuoteModal)}
                disabled={quoteLoading || !quoteText.trim()}
                className="btn primary"
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {quoteLoading ? 'Posting...' : '💬 Post Quote Cast'}
              </button>
              
              <button
                onClick={() => {
                  setShowQuoteModal(null);
                  setQuoteText("");
                }}
                className="btn"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  opacity: 0.7
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />
      {loadingMore && (
        <p className="text-center text-sm text-zinc-500 py-2">Loading…</p>
      )}
    </div>
    </>
  );
}
