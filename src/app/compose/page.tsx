"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { usePrivy } from '@privy-io/react-auth';
import { useFarcasterWrites } from '@/hooks/useFarcasterWrites';

export default function ComposePage() {
  const router = useRouter();
  const { user } = usePrivy();
  const { hasActiveSigner, requestSigner, submitCast } = useFarcasterWrites();
  const farcasterAccount = user?.linkedAccounts?.find((a: any) => a.type === 'farcaster') as any;
  const userFid: number | null = farcasterAccount?.fid ?? null;

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
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
    if (!activeTrigger || activeTrigger.query.length < 1) {
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
    const cursorPos = e.target.selectionStart;
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

  // Detect URLs in text and fetch preview
  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex);
    
    if (matches && matches.length > 0) {
      const url = matches[0];
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


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setStatus("Image too large. Maximum size is 10MB.");
      return;
    }

    if (!file.type.startsWith('image/')) {
      setStatus("Please select an image file.");
      return;
    }

    setUploadingImage(true);
    setStatus("Uploading image...");

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Include Privy signer public key for authenticated upload
      const signerKey = farcasterAccount?.signerPublicKey;
      if (signerKey) {
        formData.append('signerUuid', signerKey);
      }

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.ok && data.url) {
        setUploadedImage(data.url);
        setImageUrl(data.url);
        setStatus("✓ Image uploaded!");
        setTimeout(() => setStatus(null), 2000);
      } else {
        setStatus(`Upload failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      setStatus(`Upload error: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setImageUrl('');
    setUploadedImage(null);
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

      // Build embeds array
      const embeds: any[] = [];

      // Add image embed if provided
      if (imageUrl.trim()) {
        embeds.push({ url: imageUrl.trim() });
      }

      // Add URL embed if we have a preview
      if (urlPreview && detectedUrl) {
        embeds.push({ url: detectedUrl });
        
        // If it's an article with text, prepend summary to cast text
        if (urlPreview.isArticle && urlPreview.articleText && !text.includes(urlPreview.metadata.title)) {
          const summary = urlPreview.articleText.slice(0, 200) + '...';
          body.text = `${urlPreview.metadata.title || 'Article'}\n\n${summary}\n\n${text}`;
        } else if (urlPreview.metadata.title && !text.includes(urlPreview.metadata.title)) {
          // For non-articles, just add the title if not already in text
          body.text = `${urlPreview.metadata.title}\n\n${text}`;
        }
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
          setImageUrl("");
          setUploadedImage(null);
          setScheduleTime("");
          setIsScheduled(false);
          setUrlPreview(null);
          setDetectedUrl(null);
          setTimeout(() => {
            router.push('/');
          }, 800);
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
        setImageUrl("");
        setUploadedImage(null);
        setUrlPreview(null);
        setDetectedUrl(null);
        setTimeout(() => {
          router.push('/');
        }, 800);
      }
    } catch (err: any) {
      setStatus(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <h1 className="text-lg font-bold">New Cast</h1>
            <div className="w-6" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6">
        {userFid && !hasActiveSigner ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-6">🔐</div>
            <h2 className="text-2xl font-bold mb-4">Enable Posting</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              To post casts from HomieHouse, approve posting permissions via Farcaster.
              This only needs to be done once.
            </p>
            <button
              className="bg-white hover:bg-zinc-200 text-black px-8 py-3 rounded-lg font-medium transition-colors"
              onClick={handleEnablePosting}
              disabled={loading}
            >
              {loading ? "Creating..." : "Enable Posting"}
            </button>
            {status && (
              <div className="mt-6 p-4 bg-zinc-900 rounded-lg text-sm">
                {status}
              </div>
            )}
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <textarea
              className="w-full bg-transparent text-white text-lg p-4 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 resize-none min-h-[200px]"
              value={text}
              onChange={handleTextChange}
              placeholder="What's on your mind?"
              autoFocus
            />
            
            {/* Unified inline autocomplete: @user, /channel, $token */}
            {activeTrigger && triggerResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: 240,
                overflowY: 'auto',
                background: '#111',
                border: '1px solid #3f3f46',
                borderRadius: 10,
                marginTop: 4,
                zIndex: 1000,
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}>
                {triggerResults.map((result, i) => (
                  <button
                    key={result.fid ?? result.id ?? result.symbol ?? i}
                    onMouseDown={(e) => { e.preventDefault(); insertTriggerResult(result); }}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: i < triggerResults.length - 1 ? '1px solid #27272a' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'white',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1c1c1c')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* @ user */}
                    {activeTrigger.type === '@' && (
                      <>
                        {result.pfp_url
                          ? <img src={result.pfp_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#27272a', flexShrink: 0 }} />
                        }
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{result.display_name}</div>
                          <div style={{ fontSize: 12, color: '#71717a' }}>@{result.username}</div>
                        </div>
                      </>
                    )}

                    {/* / channel */}
                    {activeTrigger.type === '/' && (
                      <>
                        {result.imageUrl
                          ? <img src={result.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 28, height: 28, borderRadius: 6, background: '#27272a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#71717a' }}>#</div>
                        }
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>/{result.id}</div>
                          {result.name && <div style={{ fontSize: 12, color: '#71717a' }}>{result.name}</div>}
                        </div>
                      </>
                    )}

                    {/* $ token */}
                    {activeTrigger.type === '$' && (
                      <>
                        {result.image
                          ? <img src={result.image} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#27272a', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#71717a', fontWeight: 700 }}>$</div>
                        }
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>${result.symbol}</div>
                          <div style={{ fontSize: 12, color: '#71717a' }}>{result.name}</div>
                        </div>
                        {result.currentPrice != null && (
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                              ${result.currentPrice < 0.01
                                ? result.currentPrice.toFixed(6)
                                : result.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}
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
            
            {/* Image preview */}
            {imageUrl && (
              <div className="relative mt-3">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="max-w-full max-h-48 rounded-xl border border-zinc-800"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/80 text-white rounded-full text-sm"
                >
                  ✕
                </button>
              </div>
            )}

            {/* URL Preview */}
            {loadingPreview && (
              <div className="mt-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-500">
                Loading preview…
              </div>
            )}
            {urlPreview && urlPreview.metadata && (
              <div className="mt-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                {urlPreview.metadata.image && (
                  <img
                    src={urlPreview.metadata.image}
                    alt={urlPreview.metadata.title}
                    className="w-full h-auto max-h-40 object-cover rounded-lg mb-2"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                {urlPreview.metadata.title && (
                  <div className="text-sm font-semibold mb-1 text-white">{urlPreview.metadata.title}</div>
                )}
                {urlPreview.metadata.description && (
                  <div className="text-xs text-zinc-400 line-clamp-2">{urlPreview.metadata.description}</div>
                )}
                <div className="text-xs text-zinc-500 mt-1">
                  {urlPreview.metadata.siteName || new URL(detectedUrl!).hostname}
                </div>
              </div>
            )}

            {/* Schedule datetime picker - shown when calendar icon is toggled */}
            {isScheduled && (
              <div className="mt-3">
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>
            )}

            {/* Compact action toolbar */}
            <div className="relative">
              {/* Channel picker — floats above toolbar */}
              {showChannelSuggestions && (
                <div className="absolute bottom-full left-0 right-0 mb-1 max-h-52 overflow-y-auto bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl z-50">
                  <div className="p-2 border-b border-zinc-800">
                    <input
                      type="text"
                      value={channelSearch}
                      onChange={(e) => setChannelSearch(e.target.value)}
                      placeholder="Search channels…"
                      className="w-full px-3 py-2 bg-zinc-800 rounded-lg text-white text-sm placeholder-zinc-500 outline-none"
                      autoFocus
                    />
                  </div>
                  {channels
                    .filter(ch =>
                      !channelSearch ||
                      ch.id?.toLowerCase().includes(channelSearch.toLowerCase()) ||
                      ch.name?.toLowerCase().includes(channelSearch.toLowerCase())
                    )
                    .slice(0, 8)
                    .map((ch) => (
                      <button
                        key={ch.id}
                        onClick={() => {
                          setSelectedChannel(ch.id);
                          setChannelSearch('');
                          setShowChannelSuggestions(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-zinc-800 transition-colors"
                      >
                        <span className="text-zinc-400">/</span>{ch.id}
                        {ch.name && <span className="text-zinc-500 ml-2 text-xs">{ch.name}</span>}
                      </button>
                    ))
                  }
                </div>
              )}

              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-zinc-800">
                {/* Photo upload icon */}
                <label
                  htmlFor="image-upload-compose"
                  className={`p-2.5 rounded-full cursor-pointer transition-colors ${uploadingImage ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                  title="Add photo"
                >
                  {uploadingImage ? (
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  <input
                    id="image-upload-compose"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                </label>

                {/* Channel button */}
                <button
                  onClick={() => setShowChannelSuggestions(!showChannelSuggestions)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${selectedChannel ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                  title="Post to channel"
                >
                  <span className="font-bold text-xs">#</span>
                  <span>{selectedChannel || 'Channel'}</span>
                  {selectedChannel && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedChannel(''); setChannelSearch(''); }}
                      className="ml-0.5 leading-none text-zinc-400 hover:text-white"
                    >
                      ×
                    </span>
                  )}
                </button>

                {/* Schedule icon */}
                <button
                  onClick={() => setIsScheduled(!isScheduled)}
                  className={`p-2.5 rounded-full transition-colors ${isScheduled ? 'text-white bg-zinc-700' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                  title="Schedule"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>

                {/* View scheduled queue */}
                <button
                  onClick={() => router.push('/scheduled')}
                  className="text-zinc-400 hover:text-white transition-colors text-sm px-1"
                >
                  Scheduled casts
                </button>

                <div className="flex-1" />

                {text.length > 0 && (
                  <span className={`text-xs mr-2 ${text.length > 280 ? 'text-red-400' : 'text-zinc-500'}`}>
                    {text.length}
                  </span>
                )}

                <button
                  className="px-5 py-2 bg-white text-black rounded-full text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 transition-colors"
                  disabled={loading || uploadingImage || (!text.trim() && !imageUrl.trim()) || (isScheduled && !scheduleTime)}
                  onClick={handlePost}
                >
                  {loading
                    ? (isScheduled ? 'Scheduling…' : 'Posting…')
                    : (isScheduled ? 'Schedule' : 'Post')
                  }
                </button>
              </div>
            </div>

            {status && (
              <div className="mt-3 p-3 bg-zinc-900 rounded-lg text-sm text-zinc-300">
                {status}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
