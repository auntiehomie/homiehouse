"use client";

import React, { useEffect, useState } from "react";
import { fetchFeed } from "../lib/farcaster";
import { useProfile } from "@farcaster/auth-kit";
import { FeedSkeleton } from "./Skeletons";
import { formatDistanceToNow } from "date-fns";
import { FeedType } from "./FeedTrendingTabs";
import { QRCodeSVG } from 'qrcode.react';

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
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [showRecastModal, setShowRecastModal] = useState<string | null>(null);
  const [seeLessAuthors, setSeeLessAuthors] = useState<Set<string>>(new Set());

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

  const pollSignerStatus = async (signerUuid: string, fid: number) => {
    let attempts = 0;
    const maxAttempts = 30; // Try for 30 seconds
    
    const checkStatus = async (): Promise<boolean> => {
      try {
        const res = await fetch(`/api/signer?signer_uuid=${signerUuid}`);
        const data = await res.json();
        
        if (data.status === 'approved') {
          // Update localStorage
          const key = `signer_${fid}`;
          localStorage.setItem(key, JSON.stringify({
            signer_uuid: signerUuid,
            status: 'approved'
          }));
          return true;
        }
        
        if (attempts < maxAttempts) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          return checkStatus();
        }
        return false;
      } catch (error) {
        console.error('Poll error:', error);
        return false;
      }
    };
    
    return checkStatus();
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

        // On mobile, auto-redirect and poll for approval
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile && data.signer_approval_url) {
          // Store pending action
          localStorage.setItem('hh_pending_action', JSON.stringify({ type: actionType, signerUuid: data.signer_uuid }));
          
          // Redirect to Warpcast
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

  const handleReply = async (castHash: string) => {
    const signerUuid = getSignerUuid();
    if (!signerUuid) {
      await createSignerAutomatically('like');
      return;
    }

    if (!replyText.trim()) {
      return;
    }

    setReplyLoading(true);
    try {
      const res = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: replyText, 
          signerUuid, 
          parentHash: castHash 
        }),
      });

      if (res.ok) {
        setReplyText("");
        setReplyingTo(null);
        alert("Reply posted successfully!");
      } else {
        const data = await res.json();
        alert(`Failed to reply: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Reply error:", error);
      alert("Failed to post reply");
    } finally {
      setReplyLoading(false);
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

  // Check for pending signer approval (after returning from Warpcast on mobile)
  useEffect(() => {
    const checkPendingApproval = async () => {
      const pending = localStorage.getItem('hh_pending_action');
      if (pending) {
        try {
          const { signerUuid } = JSON.parse(pending);
          const storedProfile = localStorage.getItem('hh_profile');
          if (storedProfile) {
            const profile = JSON.parse(storedProfile);
            const fid = profile?.fid;
            if (fid) {
              // Poll for approval
              const approved = await pollSignerStatus(signerUuid, fid);
              if (approved) {
                alert('Signer approved! You can now interact with casts.');
              }
              // Clear pending action
              localStorage.removeItem('hh_pending_action');
            }
          }
        } catch (e) {
          console.error('Error checking pending approval:', e);
        }
      }
    };
    
    checkPendingApproval();
  }, []);

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
  // Reduce visibility of "see less" authors (show 1 in 4)
  const filteredItems = items.filter((it, index) => {
    const authorObj = it.author && typeof it.author === 'object' ? it.author : null;
    const authorUsername = authorObj?.username || it.author || it.handle;
    const castHash = it.hash || it.id;
    
    if (authorUsername && mutedUsers.has(authorUsername)) return false;
    if (castHash && hiddenCasts.has(castHash)) return false;
    
    // Reduce "see less" authors - only show 25% of their content
    if (authorUsername && seeLessAuthors.has(authorUsername)) {
      return index % 4 === 0; // Only show every 4th post
    }
    
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
                onClick={() => setShowRecastModal(key)}
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
              
              <button
                onClick={() => setReplyingTo(replyingTo === key ? null : key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  color: replyingTo === key ? '#3b82f6' : 'var(--muted-on-dark)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (replyingTo !== key) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                    e.currentTarget.style.color = '#3b82f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (replyingTo !== key) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted-on-dark)';
                  }
                }}
              >
                💬 Reply
              </button>

              <button
                onClick={() => {
                  const castText = typeof it.text === 'string' ? it.text : (it.body ?? (typeof it.message === 'string' ? it.message : ''));
                  const castData = encodeURIComponent(JSON.stringify({
                    author: authorUsername,
                    text: castText,
                    hash: key
                  }));
                  window.location.href = `/ask-homie?cast=${castData}`;
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted-on-dark)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
                  e.currentTarget.style.color = '#a855f7';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--muted-on-dark)';
                }}
              >
                🤖 Ask Homie
              </button>
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
                    onClick={() => handleReply(key)}
                    disabled={replyLoading || !replyText.trim()}
                  >
                    {replyLoading ? "Posting..." : "Post Reply"}
                  </button>
                </div>
              </div>
            )}
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
                <>
                  <div style={{ background: 'white', padding: '16px', borderRadius: '8px', display: 'inline-block', marginBottom: '12px' }}>
                    <QRCodeSVG value={signerApprovalUrl} size={200} />
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', marginBottom: 12 }}>
                    Scan this QR code or click below to approve:
                  </p>
                  <a 
                    href={signerApprovalUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn primary" 
                    style={{ display: 'block', textAlign: 'center', marginBottom: 12, padding: '12px', width: '100%' }}
                  >
                    Approve in Warpcast →
                  </a>
                </>
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
              Recast Options
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recastedCasts.has(showRecastModal) ? (
                <button
                  onClick={async () => {
                    await handleRecast(showRecastModal);
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
                    await handleRecast(showRecastModal);
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
              
              <button
                onClick={() => {
                  // TODO: Implement quote cast functionality
                  alert('Quote cast coming soon!');
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
                  gap: '8px'
                }}
              >
                💬 Quote Cast
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
    </div>
  );
}
