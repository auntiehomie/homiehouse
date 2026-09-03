"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { useFarcasterWrites } from '@/hooks/useFarcasterWrites';

function ComposePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fid: userFid } = useFarcasterAuth()
  const { hasActiveSigner, requestSigner, submitCast, getPrivateKeyHex } = useFarcasterWrites();

  const [text, setText] = useState(searchParams.get('text') || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [scheduleTime, setScheduleTime] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [channels, setChannels] = useState<any[]>([]);
  const [showChannelSuggestions, setShowChannelSuggestions] = useState(false);
  const [channelSearch, setChannelSearch] = useState<string>('');
  const [urlPreview, setUrlPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);

  // Unified inline trigger autocomplete (@mention, /channel, $token)
  const [activeTrigger, setActiveTrigger] = useState<{ type: '@' | '/' | '$'; query: string; startPos: number } | null>(null);
  const [triggerResults, setTriggerResults] = useState<any[]>([]);

  // Load channels on mount
  useEffect(() => {
    if (userFid) fetchChannels(userFid);
  }, [userFid]);

  async function fetchChannels(fid: number) {
    try {
      const response = await fetch(`/api/channels?fid=${fid}&limit=100`);
      const data = await response.json();

      if (data.ok && data.channels) {
        // Filter to human-readable channel IDs only (exclude token-gated URI channels)
        const clean = data.channels.filter((ch: any) =>
          ch.id && !ch.id.includes(':') && !ch.id.includes('/')
        );
        setChannels(clean.length ? clean : data.channels.slice(0, 20));
      } else {
        // Fallback to popular channels
        setChannels([
          { id: 'base', name: 'Base' },
          { id: 'farcaster', name: 'Farcaster' },
          { id: 'dev', name: 'Dev' },
          { id: 'art', name: 'Art' },
          { id: 'music', name: 'Music' },
        ]);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      // Fallback to popular channels
      setChannels([
        { id: 'base', name: 'Base' },
        { id: 'farcaster', name: 'Farcaster' },
        { id: 'dev', name: 'Dev' },
        { id: 'art', name: 'Art' },
        { id: 'music', name: 'Music' },
      ]);
    }
  }

  // Unified trigger search: @user, /channel, $token
  useEffect(() => {
    if (!activeTrigger || activeTrigger.query.length < 2) {
      setTriggerResults([]);
      return;
    }
    const { type, query } = activeTrigger;
    const delay = type === '/' ? 0 : 300;
    const timer = setTimeout(async () => {
      try {
        if (type === '@') {
          const r = await fetch(`/api/search-users?q=${encodeURIComponent(query)}`);
          const d = await r.json();
          setTriggerResults(d.users?.slice(0, 6) || []);
        } else if (type === '/') {
          const filtered = channels.filter(ch =>
            ch.id?.toLowerCase().includes(query.toLowerCase()) ||
            ch.name?.toLowerCase().includes(query.toLowerCase())
          );
          setTriggerResults(filtered.slice(0, 8));
        } else if (type === '$') {
          const r = await fetch(`/api/tokens/search?q=${encodeURIComponent(query)}&limit=6`);
          const d = await r.json();
          setTriggerResults(d.tokens || []);
        }
      } catch {}
    }, delay);
    return () => clearTimeout(timer);
  }, [activeTrigger, channels]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    // selectionStart can be null on iOS Safari during IME/autocorrect — fall back to end of text
    const cursorPos = e.target.selectionStart ?? newText.length;
    setText(newText);

    const before = newText.substring(0, cursorPos);
    // Find the last trigger character before the cursor
    const candidates = (['@', '/', '$'] as const).map(t => ({ type: t, pos: before.lastIndexOf(t) })).filter(c => c.pos !== -1);
    const best = candidates.sort((a, b) => b.pos - a.pos)[0];

    if (best) {
      const query = before.substring(best.pos + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setActiveTrigger({ type: best.type, query, startPos: best.pos });
        return;
      }
    }

    setActiveTrigger(null);
    setTriggerResults([]);
  };

  function insertTriggerResult(result: any) {
    if (!activeTrigger) return;
    const { type, startPos, query } = activeTrigger;
    const before = text.substring(0, startPos);
    const after = text.substring(startPos + query.length + 1);

    if (type === '@') {
      setText(`${before}@${result.username} ${after}`);
    } else if (type === '/') {
      // Strip the /query from text; channel is tracked separately
      setText((before + after).replace(/^\s+/, ''));
      setSelectedChannel(result.id);
    } else if (type === '$') {
      setText(`${before}$${result.symbol} ${after}`);
    }

    setActiveTrigger(null);
    setTriggerResults([]);
  }

  // Detect URLs in text and fetch preview (handles https:// and bare domains)
  useEffect(() => {
    const urlRegex = /(?:https?:\/\/[^\s]+|(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|io|lol|xyz|app|dev|co|ai|eth|fyi|gg|wtf|run|fun|us|uk|ca|au|de|fr|jp)[^\s]*)/gi;
    const matches = text.match(urlRegex);

    if (matches && matches.length > 0) {
      const rawUrl = matches[0];
      const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      if (url !== detectedUrl) {
        setDetectedUrl(url);
        fetchUrlPreview(url);
      }
    } else {
      setDetectedUrl(null);
      setUrlPreview(null);
    }
  }, [text]);

  const fetchUrlPreview = async (url: string) => {
    setLoadingPreview(true);
    try {
      const response = await fetch('/api/url-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setUrlPreview(data);
        }
      }
    } catch (error) {
      console.error('Error fetching URL preview:', error);
    } finally {
      setLoadingPreview(false);
    }
  };


  // Farcaster supports max 2 embeds per cast. A URL preview occupies one slot,
  // so the image limit is 1 when a URL is detected, otherwise 2.
  const maxImages = urlPreview && detectedUrl ? 1 : 2;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // reset so same file can be re-selected
    if (!files.length) return;

    const slots = maxImages - uploadedImages.length;
    if (slots <= 0) return;

    const toUpload = files.slice(0, slots);
    setUploadingImage(true);

    const uploaded: string[] = [];
    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i];
      if (file.size > 10 * 1024 * 1024) { setStatus(`${file.name}: over 10 MB, skipped`); continue; }
      if (!file.type.startsWith('image/')) continue;

      setStatus(toUpload.length > 1 ? `Uploading ${i + 1} of ${toUpload.length}…` : 'Uploading image…');
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.ok && data.url) { uploaded.push(data.url); }
        else { setStatus(`Upload failed: ${data.error || 'Unknown error'}`); }
      } catch (err: any) { setStatus(`Upload error: ${err.message}`); }
    }

    if (uploaded.length) {
      setUploadedImages(prev => [...prev, ...uploaded]);
      setStatus(uploaded.length > 1 ? `✓ ${uploaded.length} images added` : '✓ Image added');
      setTimeout(() => setStatus(null), 2000);
    }
    setUploadingImage(false);
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  async function handleEnablePosting() {
    setLoading(true);
    try {
      // Read any existing approval URL from localStorage
      let approvalUrl: string | null = null;
      try {
        const raw = localStorage.getItem(`signer_${userFid}`);
        if (raw) approvalUrl = JSON.parse(raw)?.signer_approval_url ?? null;
      } catch {}

      // Show the modal immediately — no waiting on async API
      window.dispatchEvent(new CustomEvent('showWelcomeModal', {
        detail: { approvalUrl },
      }));

      // Also kick off signer creation so SignerInit can update the modal with a real URL
      window.dispatchEvent(new CustomEvent('hh:request:signer', { detail: { fid: userFid } }));
    } finally {
      setLoading(false);
    }
  }

  async function handlePost() {
    setStatus(null);
    setLoading(true);
    try {
      if (!userFid) {
        setStatus("Sign in to post.");
        setLoading(false);
        return;
      }

      if (!hasActiveSigner) {
        setStatus("Please enable posting first.");
        setLoading(false);
        return;
      }

      const body: any = { text, fid: userFid };

      // Build embeds — max 2 per Farcaster protocol
      const embeds: any[] = uploadedImages.map(url => ({ url }));
      // URL preview takes the remaining slot (if any)
      if (urlPreview && detectedUrl && embeds.length < 2) {
        embeds.push({ url: detectedUrl });
      }
      if (embeds.length > 0) {
        body.embeds = embeds;
      }

      // Add channel if selected
      if (selectedChannel) {
        body.channelKey = selectedChannel;
        console.log('[ComposePage] Adding channel to post:', selectedChannel);
      } else {
        console.log('[ComposePage] No channel selected');
      }

      // If scheduled, save to database instead of posting immediately
      if (isScheduled && scheduleTime) {
        const scheduledDate = new Date(scheduleTime);
        const now = new Date();

        if (scheduledDate <= now) {
          setStatus("Scheduled time must be in the future.");
          setLoading(false);
          return;
        }

        body.scheduled_time = scheduledDate.toISOString();

        // Pass the user's signer private key so the server can sign the cast at publish time
        const signerPrivateKey = getPrivateKeyHex();
        if (!signerPrivateKey) {
          setStatus("Posting permissions required to schedule. Tap 'Enable Posting', approve in Warpcast, then try again.");
          setLoading(false);
          return;
        }
        body.private_key = signerPrivateKey;

        console.log('[ComposePage] Scheduling cast, sending POST to /api/schedule-cast with body:', JSON.stringify(body, null, 2));
        const res = await fetch("/api/schedule-cast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        console.log(`[ComposePage] Schedule response status: ${res.status} ${res.statusText}`);
        
        let data;
        try {
          data = await res.json();
          console.log('[ComposePage] Schedule response body:', data);
        } catch (parseErr) {
          console.error('[ComposePage] Failed to parse schedule response:', parseErr);
          const text = await res.text();
          console.error('[ComposePage] Raw schedule response:', text);
          setStatus(`Server error (${res.status}): Could not parse response. Check console.`);
          setLoading(false);
          return;
        }
        
        if (data.ok) {
          setStatus("✓ Cast scheduled successfully!");
          setText("");
          setUploadedImages([]);
          setScheduleTime("");
          setIsScheduled(false);
          setUrlPreview(null);
          setDetectedUrl(null);
          setTimeout(() => {
            router.back();
          }, 1500);
        } else {
          const errorMsg = data.error || data.message || "unknown error";
          const errorCode = data.code || '';
          const fullError = errorCode ? `${errorMsg} (${errorCode})` : errorMsg;
          console.error('[ComposePage] Schedule API error:', { status: res.status, error: errorMsg, code: errorCode });
          setStatus(`Failed: ${fullError}. Response status: ${res.status}`);
        }
            } else {
        // Post immediately via local signer
        await submitCast({
          text: body.text,
          embeds: body.embeds,
          channelKey: body.channelKey,
        });
        setStatus("✓ Posted successfully!");
        setText("");
        setUploadedImages([]);
        setUrlPreview(null);
        setDetectedUrl(null);
        setTimeout(() => {
          router.back();
        }, 1500);
      }
    } catch (err: any) {
      setStatus(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  const muted = { color: 'var(--muted-on-dark)' } as React.CSSProperties;
  const toolBtn: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 8, background: 'none', border: 'none',
    color: 'var(--muted-on-dark)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-on-dark)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-dark)', zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', ...muted, display: 'flex' }}>
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-on-dark)' }}>New Cast</h1>
        <div style={{ width: 22 }} />
      </header>

      {/* Extra bottom padding = fixed toolbar (~56px) + bottom nav (~100px) + breathing room */}
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '12px 16px', paddingBottom: 130 }}>
        {!userFid ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>💬</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, color: 'var(--text-on-dark)' }}>Connect to Cast</h2>
            <p style={{ color: 'var(--muted-on-dark)', marginBottom: 28, maxWidth: 320, margin: '0 auto 28px', lineHeight: 1.6, fontSize: 14 }}>
              You need a Farcaster account to post. Sign in or import your account to get started.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 280, margin: '0 auto' }}>
              <button
                onClick={() => router.push('/')}
                style={{ padding: '11px 24px', borderRadius: 24, background: 'var(--btn-primary-bg, #fff)', color: 'var(--btn-primary-color, #000)', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
              >
                Sign in with Farcaster
              </button>
              <button
                onClick={() => router.push('/settings')}
                style={{ padding: '11px 24px', borderRadius: 24, background: 'none', color: 'var(--text-on-dark)', fontWeight: 600, fontSize: 14, border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                Import account in Settings
              </button>
            </div>
            <p style={{ color: 'var(--muted-on-dark)', fontSize: 12, marginTop: 20, lineHeight: 1.5 }}>
              In Settings → Account, you can import any Farcaster account using your recovery phrase for full posting access.
            </p>
          </div>
        ) : userFid && !hasActiveSigner ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>🔐</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: 'var(--text-on-dark)' }}>Enable Posting</h2>
            <p style={{ ...muted, marginBottom: 28, maxWidth: 340, margin: '0 auto 28px', lineHeight: 1.5 }}>
              To post casts from HomieHouse, approve posting permissions via Farcaster. This only needs to be done once.
            </p>
            <button
              onClick={handleEnablePosting}
              disabled={loading}
              style={{ padding: '10px 28px', borderRadius: 24, background: 'var(--btn-primary-bg, #fff)', color: 'var(--btn-primary-color, #000)', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
            >
              {loading ? 'Creating…' : 'Enable Posting'}
            </button>
            {status && <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--surface)', borderRadius: 10, fontSize: 13, ...muted }}>{status}</div>}
          </div>
        ) : null}
        {userFid && hasActiveSigner && (
          <div>
            {/* Textarea with floating autocomplete */}
            <div style={{ position: 'relative' }}>
              <textarea
                value={text}
                onChange={handleTextChange}
                placeholder="What's on your mind?"
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--surface)', color: 'var(--text-on-dark)',
                  fontSize: 16, padding: '14px', lineHeight: 1.6,
                  border: '1px solid var(--border)', borderRadius: 12,
                  outline: 'none', resize: 'none', minHeight: 130,
                  fontFamily: 'inherit',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />

              {/* Autocomplete dropdown */}
              {activeTrigger && triggerResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                  maxHeight: 240, overflowY: 'auto',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                }}>
                  {triggerResults.map((result, i) => (
                    <button
                      key={result.fid ?? result.id ?? result.symbol ?? i}
                      onMouseDown={e => { e.preventDefault(); insertTriggerResult(result); }}
                      onTouchStart={e => { e.preventDefault(); insertTriggerResult(result); }}
                      style={{
                        width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                        background: 'transparent', border: 'none',
                        borderBottom: i < triggerResults.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer', textAlign: 'left', color: 'var(--text-on-dark)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {activeTrigger.type === '@' && (
                        <>
                          {result.pfp_url
                            ? <img src={result.pfp_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
                          }
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{result.display_name}</div>
                            <div style={{ fontSize: 12, ...muted }}>@{result.username}</div>
                          </div>
                        </>
                      )}
                      {activeTrigger.type === '/' && (
                        <>
                          {result.imageUrl
                            ? <img src={result.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, ...muted }}>#</div>
                          }
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>/{result.id}</div>
                            {result.name && <div style={{ fontSize: 12, ...muted }}>{result.name}</div>}
                          </div>
                        </>
                      )}
                      {activeTrigger.type === '$' && (
                        <>
                          {result.image
                            ? <img src={result.image} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, ...muted, fontWeight: 700 }}>$</div>
                          }
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>${result.symbol}</div>
                            <div style={{ fontSize: 12, ...muted }}>{result.name}</div>
                          </div>
                          {result.currentPrice != null && (
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>
                                ${result.currentPrice < 0.01 ? result.currentPrice.toFixed(6) : result.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </div>
                              {result.priceChangePercentage24h != null && (
                                <div style={{ fontSize: 11, color: result.priceChangePercentage24h >= 0 ? '#4ade80' : '#f87171' }}>
                                  {result.priceChangePercentage24h >= 0 ? '+' : ''}{result.priceChangePercentage24h.toFixed(2)}%
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Image previews */}
            {uploadedImages.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: uploadedImages.length === 1 ? '1fr' : '1fr 1fr',
                gap: 8, marginTop: 10,
              }}>
                {uploadedImages.map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img
                      src={url} alt={`Image ${i + 1}`}
                      style={{ width: '100%', height: uploadedImages.length === 1 ? 192 : 140, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', display: 'block' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <button
                      onClick={() => removeImage(i)}
                      style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.72)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* URL preview */}
            {detectedUrl && (
              loadingPreview ? (
                <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, ...muted }}>Loading preview…</div>
              ) : (
                <a href={detectedUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  style={{ display: 'block', marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', textDecoration: 'none' }}>
                  {urlPreview?.metadata?.image && (
                    <img src={urlPreview.metadata.image} alt={urlPreview.metadata.title} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <div style={{ padding: '10px 12px' }}>
                    {urlPreview?.metadata?.title && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-on-dark)', marginBottom: 3 }}>{urlPreview.metadata.title}</div>}
                    {urlPreview?.metadata?.description && <div style={{ fontSize: 12, ...muted, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{urlPreview.metadata.description}</div>}
                    <div style={{ fontSize: 11, ...muted }}>{urlPreview?.metadata?.siteName || (() => { try { return new URL(detectedUrl).hostname; } catch { return detectedUrl; } })()}</div>
                  </div>
                </a>
              )
            )}

            {/* Schedule picker */}
            {isScheduled && (
              <div style={{ marginTop: 10 }}>
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-on-dark)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
            )}

            {status && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--muted-on-dark)' }}>
                {status}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Fixed toolbar — always visible above the bottom nav */}
      <div style={{
        position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, zIndex: 100,
        background: 'var(--bg-dark)', borderTop: '1px solid var(--border)',
      }}>
        {/* Channel picker opens upward from here */}
        {showChannelSuggestions && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 0, maxHeight: 220, overflowY: 'auto', background: 'var(--bg-dark)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '12px 12px 0 0', boxShadow: '0 -4px 24px rgba(0,0,0,0.5)', zIndex: 50 }}>
            <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
              <input
                type="text"
                value={channelSearch}
                onChange={e => setChannelSearch(e.target.value)}
                placeholder="Search channels…"
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-on-dark)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            {channels.filter(ch => !channelSearch || ch.id?.toLowerCase().includes(channelSearch.toLowerCase()) || ch.name?.toLowerCase().includes(channelSearch.toLowerCase())).slice(0, 8).map(ch => (
              <button key={ch.id} onClick={() => { setSelectedChannel(ch.id); setChannelSearch(''); setShowChannelSuggestions(false); }}
                style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, color: 'var(--text-on-dark)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={muted}>/</span>{ch.id}
                {ch.name && <span style={{ ...muted, marginLeft: 8, fontSize: 12 }}>{ch.name}</span>}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', boxSizing: 'border-box', width: '100%', overflow: 'hidden' }}>
          {/* Left scrollable actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto', flex: 1, minWidth: 0, scrollbarWidth: 'none' }}>
            <label
              htmlFor="image-upload-compose"
              style={{ ...toolBtn, cursor: (uploadingImage || uploadedImages.length >= maxImages) ? 'not-allowed' : 'pointer', opacity: (uploadingImage || uploadedImages.length >= maxImages) ? 0.4 : 1 }}
              title={uploadedImages.length >= maxImages ? `Max ${maxImages} image${maxImages > 1 ? 's' : ''}` : 'Add photo'}
            >
              {uploadingImage
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity=".75"/></svg>
                : <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              }
              {uploadedImages.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 3, color: uploadedImages.length >= maxImages ? '#f87171' : 'var(--muted-on-dark)' }}>
                  {uploadedImages.length}/{maxImages}
                </span>
              )}
              <input id="image-upload-compose" type="file" accept="image/*" multiple onChange={handleImageUpload} disabled={uploadingImage || uploadedImages.length >= maxImages} style={{ display: 'none' }} />
            </label>

            <button onClick={() => setShowChannelSuggestions(!showChannelSuggestions)} title="Post to channel"
              style={{ ...toolBtn, gap: 4, paddingLeft: 10, paddingRight: 10, background: selectedChannel ? 'rgba(255,255,255,0.1)' : 'none', color: selectedChannel ? 'var(--text-on-dark)' : 'var(--muted-on-dark)' }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>#</span>
              <span style={{ fontSize: 13 }}>{selectedChannel || 'Channel'}</span>
              {selectedChannel && (
                <span role="button" onClick={e => { e.stopPropagation(); setSelectedChannel(''); setChannelSearch(''); }} style={{ marginLeft: 2, ...muted }}>×</span>
              )}
            </button>

            <button onClick={() => setIsScheduled(!isScheduled)} title="Schedule this cast"
              style={{ ...toolBtn, background: isScheduled ? 'rgba(255,255,255,0.1)' : 'none', color: isScheduled ? 'var(--text-on-dark)' : 'var(--muted-on-dark)' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>

            <button onClick={() => router.push('/scheduled')} title="View scheduled casts"
              style={{ ...toolBtn, gap: 4, paddingLeft: 10, paddingRight: 10 }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span style={{ fontSize: 12 }}>Scheduled</span>
            </button>
          </div>

          {/* Right: char count + Post/Schedule button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto', paddingLeft: 8 }}>
            {text.length > 260 && (
              <span style={{
                fontSize: 12,
                color: text.length > 10000
                  ? '#f87171'
                  : text.length > 9900
                  ? '#f87171'
                  : text.length > 9700
                  ? '#fb923c'
                  : text.length > 320
                  ? 'var(--muted-on-dark)'
                  : text.length > 300
                  ? '#fb923c'
                  : text.length > 280
                  ? '#f87171'
                  : 'var(--muted-on-dark)',
                minWidth: 28, textAlign: 'right',
              }}>
                {text.length > 320 ? `${text.length.toLocaleString()} / 10,000` : text.length}
              </span>
            )}
            <button
              onClick={handlePost}
              disabled={loading || uploadingImage || (!text.trim() && !uploadedImages.length) || (isScheduled && !scheduleTime)}
              style={{
                padding: '7px 14px', borderRadius: 24, border: 'none', cursor: 'pointer',
                background: 'var(--btn-primary-bg, #fff)', color: 'var(--btn-primary-color, #000)',
                fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                opacity: (loading || uploadingImage || (!text.trim() && !uploadedImages.length) || (isScheduled && !scheduleTime)) ? 0.4 : 1,
              }}
            >
              {loading ? '…' : (isScheduled ? 'Schedule' : 'Post')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-dark)' }} />}>
      <ComposePageInner />
    </Suspense>
  );
}
