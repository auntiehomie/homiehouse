"use client";

import React, { useEffect, useState } from "react";
import { fetchFeed } from "../lib/farcaster";
import { useProfile } from "@farcaster/auth-kit";
import { FeedSkeleton } from "./Skeletons";
import { formatDistanceToNow } from "date-fns";
import { FeedType } from "./FeedTrendingTabs";

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
  const [showActions, setShowActions] = useState<string | null>(null);
  const [likedCasts, setLikedCasts] = useState<Set<string>>(new Set());
  const [recastedCasts, setRecastedCasts] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { isAuthenticated, profile } = useProfile();

  const [showSignerModal, setShowSignerModal] = useState(false);
  const [signerApprovalUrl, setSignerApprovalUrl] = useState<string | null>(null);
  const [creatingSignerFor, setCreatingSignerFor] = useState<'like' | 'recast' | null>(null);

  // Get user's signer UUID from localStorage
  const getSignerUuid = () => {
    const storedProfile = localStorage.getItem("hh_profile");
    if (!storedProfile) return null;
    
    try {
      const profile = JSON.parse(storedProfile);
      const fid = profile?.fid;
      if (!fid) return null;
      
      const key = `signer_${fid}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.signer_uuid || null;
      }
    } catch {
      return null;
    }
    return null;
  };

  const createSignerAutomatically = async (actionType: 'like' | 'recast') => {
    setCreatingSignerFor(actionType);
    try {
      const res = await fetch("/api/signer", { method: "POST" });
      const data = await res.json();

      if (data.ok && data.signer_uuid) {
        const storedProfile = localStorage.getItem("hh_profile");
        if (storedProfile) {
          const profile = JSON.parse(storedProfile);
          const fid = profile?.fid;
          if (fid) {
            const key = `signer_${fid}`;
            localStorage.setItem(key, JSON.stringify({
              signer_uuid: data.signer_uuid,
              status: data.status,
              signer_approval_url: data.signer_approval_url
            }));
          }
        }

        // Show approval modal
        setSignerApprovalUrl(data.signer_approval_url);
        setShowSignerModal(true);

        // On mobile, auto-redirect
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile && data.signer_approval_url) {
          window.location.href = data.signer_approval_url;
        }
      }
    } catch (error) {
      console.error("Signer creation error:", error);
      alert("Failed to create signer. Please try again.");
    } finally {
      setCreatingSignerFor(null);
    }
  };

  const handleLike = async (castHash: string) => {
    const signerUuid = getSignerUuid();
    if (!signerUuid) {
      await createSignerAutomatically('like');
      return;
    }

    setActionLoading(`like-${castHash}`);
    try {
      const isLiked = likedCasts.has(castHash);
      
      if (isLiked) {
        // Unlike
        const res = await fetch(`/api/like?castHash=${castHash}&signerUuid=${signerUuid}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setLikedCasts(prev => {
            const next = new Set(prev);
            next.delete(castHash);
            return next;
          });
        }
      } else {
        // Like
        const res = await fetch("/api/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ castHash, signerUuid }),
        });
        if (res.ok) {
          setLikedCasts(prev => new Set([...prev, castHash]));
        }
      }
    } catch (error) {
      console.error("Like error:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecast = async (castHash: string) => {
    const signerUuid = getSignerUuid();
    if (!signerUuid) {
      await createSignerAutomatically('recast');
      return;
    }

    setActionLoading(`recast-${castHash}`);
    try {
      const isRecasted = recastedCasts.has(castHash);
      
      if (isRecasted) {
        // Remove recast
        const res = await fetch(`/api/recast?castHash=${castHash}&signerUuid=${signerUuid}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setRecastedCasts(prev => {
            const next = new Set(prev);
            next.delete(castHash);
            return next;
          });
        }
      } else {
        // Recast
        const res = await fetch("/api/recast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ castHash, signerUuid }),
        });
        if (res.ok) {
          setRecastedCasts(prev => new Set([...prev, castHash]));
        }
      }
    } catch (error) {
      console.error("Recast error:", error);
    } finally {
      setActionLoading(null);
    }
  };
  useEffect(() => {
    let mounted = true;
    (async () => {
      let res;
      try {
        const fid = (profile?.fid as any) ?? undefined;
        
        // Build query params based on feed type and channel
        let url = `/api/feed?feed_type=${feedType}`;
        if (fid) url += `&fid=${encodeURIComponent(String(fid))}`;
        if (selectedChannel) url += `&channel=${encodeURIComponent(selectedChannel)}`;
        
        const feedRes = await fetch(url);
        if (feedRes.ok) {
          res = await feedRes.json();
          if (res?.data) res = res.data;
        } else {
          // fallback to host SDK if server can't provide feed
          res = await fetchFeed(20);
        }
      } catch (e) {
        res = await fetchFeed(20);
      }

      if (mounted) setItems(res);
    })();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, profile, feedType, selectedChannel]);

  if (items === null)
    return (
      <div aria-busy="true" aria-live="polite">
        <FeedSkeleton count={3} />
      </div>
    );
  if (!items.length) return <div className="surface">No casts to show. Follow people to populate your feed.</div>;

  // Filter out muted users and hidden casts
  const filteredItems = items.filter((it) => {
    const authorObj = it.author && typeof it.author === 'object' ? it.author : null;
    const authorUsername = authorObj?.username || it.author || it.handle;
    const castHash = it.hash || it.id;
    
    if (authorUsername && mutedUsers.has(authorUsername)) return false;
    if (castHash && hiddenCasts.has(castHash)) return false;
    
    return true;
  });

  return (
    <div className="space-y-4">
      {filteredItems.map((it) => {
        const rawTs = it.timestamp ?? it.ts ?? it.time ?? null;
        const authorObj = it.author && typeof it.author === 'object' ? it.author : null;
        const authorName = authorObj?.display_name || authorObj?.username || it.author || it.handle || 'Unknown';
        const authorUsername = authorObj?.username || it.author || it.handle;
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

        return (
          <article key={key} className="surface" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ fontWeight: 700 }}>{authorName}</div>
              <button
                onClick={() => setShowActions(showActions === key ? null : key)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted-on-dark)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '0 8px'
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
            <div style={{ 
              marginTop: 6, 
              wordBreak: 'break-word', 
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap'
            }}>
              {text}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted-on-dark)' }}>{timeLabel}</div>
            
            {/* Like and Recast buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              marginTop: '12px', 
              paddingTop: '12px', 
              borderTop: '1px solid var(--border)' 
            }}>
              <button
                onClick={() => handleLike(key)}
                disabled={actionLoading === `like-${key}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  color: likedCasts.has(key) ? 'var(--accent)' : 'var(--muted-on-dark)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!likedCasts.has(key)) {
                    e.currentTarget.style.background = 'rgba(232, 119, 34, 0.1)';
                    e.currentTarget.style.color = 'var(--accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!likedCasts.has(key)) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted-on-dark)';
                  }
                }}
              >
                {likedCasts.has(key) ? '❤️' : '🤍'} 
                {actionLoading === `like-${key}` ? 'Loading...' : 'Like'}
              </button>
              
              <button
                onClick={() => handleRecast(key)}
                disabled={actionLoading === `recast-${key}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  color: recastedCasts.has(key) ? '#10b981' : 'var(--muted-on-dark)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!recastedCasts.has(key)) {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                    e.currentTarget.style.color = '#10b981';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!recastedCasts.has(key)) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted-on-dark)';
                  }
                }}
              >
                🔁 {actionLoading === `recast-${key}` ? 'Loading...' : (recastedCasts.has(key) ? 'Recasted' : 'Recast')}
              </button>
            </div>
          </article>
        );
      })}

      {/* Signer Approval Modal */}
      {showSignerModal && (
        <div className="modal-overlay" onClick={() => setShowSignerModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
                Approve Posting Permissions
              </h3>
              <p style={{ color: 'var(--muted-on-dark)', marginBottom: 24, lineHeight: 1.6 }}>
                To {creatingSignerFor} casts, you need to approve posting permissions in Warpcast.
                This only needs to be done once.
              </p>
              
              {signerApprovalUrl && (
                <a 
                  href={signerApprovalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn primary" 
                  style={{ display: 'block', textAlign: 'center', marginBottom: 12, padding: '12px', width: '100%' }}
                >
                  Approve in Warpcast →
                </a>
              )}
              
              <button 
                className="btn" 
                onClick={() => setShowSignerModal(false)}
                style={{ width: '100%', padding: '12px' }}
              >
                Close
              </button>
              
              <p style={{ fontSize: '13px', color: 'var(--muted-on-dark)', marginTop: '16px' }}>
                After approving, refresh the page and try again.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
