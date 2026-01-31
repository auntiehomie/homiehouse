"use client";

import React, { useState, useEffect } from "react";

interface ScheduledCast {
  id: string;
  text: string;
  scheduled_time: string;
  status: string;
  embeds: any[];
  error_message?: string;
}

export default function ScheduledCastsModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scheduledCasts, setScheduledCasts] = useState<ScheduledCast[]>([]);
  const [userFid, setUserFid] = useState<number | null>(null);

  // Load user profile
  useEffect(() => {
    const storedProfile = localStorage.getItem("hh_profile");
    if (storedProfile) {
      try {
        const profile = JSON.parse(storedProfile);
        setUserFid(profile?.fid);
      } catch {
        // ignore
      }
    }
  }, []);

  // Fetch scheduled casts when modal opens
  useEffect(() => {
    if (open && userFid) {
      fetchScheduledCasts();
    }
  }, [open, userFid]);

  // Listen for custom event to open modal
  useEffect(() => {
    const handleOpenScheduled = () => {
      setOpen(true);
    };

    window.addEventListener('openScheduledCasts' as any, handleOpenScheduled as EventListener);
    
    return () => {
      window.removeEventListener('openScheduledCasts' as any, handleOpenScheduled as EventListener);
    };
  }, []);

  async function fetchScheduledCasts() {
    if (!userFid) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule-cast?fid=${userFid}`);
      const data = await res.json();
      
      if (data.ok) {
        setScheduledCasts(data.scheduled_casts || []);
      }
    } catch (error) {
      console.error('Error fetching scheduled casts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function cancelCast(id: string) {
    if (!userFid) return;
    
    try {
      const res = await fetch(`/api/schedule-cast?id=${id}&fid=${userFid}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (data.ok) {
        // Remove from list
        setScheduledCasts(casts => casts.filter(c => c.id !== id));
      }
    } catch (error) {
      console.error('Error cancelling cast:', error);
    }
  }

  async function publishNow(id: string) {
    if (!userFid) return;
    
    try {
      const res = await fetch('/api/publish-scheduled-casts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fid: userFid })
      });
      
      const data = await res.json();
      
      if (data.ok) {
        // Refresh the list
        await fetchScheduledCasts();
      } else {
        alert(`Failed to publish: ${data.error}`);
      }
    } catch (error) {
      console.error('Error publishing cast:', error);
      alert('Error publishing cast');
    }
  }

  function formatDate(isoString: string) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `in ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
    }
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    }
    
    return date.toLocaleString();
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          background: 'var(--background)',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>📅 Scheduled Casts</h2>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--muted)'
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
            Loading...
          </div>
        ) : scheduledCasts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
            No scheduled casts
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {scheduledCasts.map((cast) => (
              <div
                key={cast.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px',
                  background: cast.status === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface)'
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: '14px', color: 'var(--foreground)', marginBottom: 4 }}>
                    {cast.text}
                  </div>
                  {cast.embeds && cast.embeds.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      📎 {cast.embeds.length} attachment{cast.embeds.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <div style={{ color: 'var(--muted)' }}>
                    {cast.status === 'failed' ? (
                      <span style={{ color: '#ef4444' }}>
                        ❌ Failed: {cast.error_message}
                      </span>
                    ) : (
                      <span>⏰ {formatDate(cast.scheduled_time)}</span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8 }}>
                    {cast.status === 'pending' && (
                      <button
                        onClick={() => publishNow(cast.id)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--foreground)',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Publish Now
                      </button>
                    )}
                    <button
                      onClick={() => cancelCast(cast.id)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      {cast.status === 'failed' ? 'Delete' : 'Cancel'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
