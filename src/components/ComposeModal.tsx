"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFarcasterWrites } from "@/hooks/useFarcasterWrites";
import { usePrivy } from "@privy-io/react-auth";

const FAB_HIDDEN_PATHS = ['/learn', '/compose', '/settings'];

export default function ComposeModal() {
  const pathname = usePathname();
  const hideFab = FAB_HIDDEN_PATHS.some(p => pathname === p || pathname?.startsWith(p + '/'));
  const { user } = usePrivy();
  const { hasActiveSigner, requestSigner, submitCast, reply } = useFarcasterWrites();
  const farcasterAccount = user?.linkedAccounts?.find((a: any) => a.type === 'farcaster') as any;
  const userFid: number | null = farcasterAccount?.fid ?? null;

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [replyParentHash, setReplyParentHash] = useState<string | null>(null);
  const [replyParentFid, setReplyParentFid] = useState<number | null>(null);
  const [replyParentName, setReplyParentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageProvider, setImageProvider] = useState<'ipfs' | 'imgbb' | null>(null);
  const [scheduleTime, setScheduleTime] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [channels, setChannels] = useState<any[]>([]);
  const [channelSearch, setChannelSearch] = useState<string>('');
  const [showChannelSuggestions, setShowChannelSuggestions] = useState(false);
  const [urlPreview, setUrlPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [isLongForm, setIsLongForm] = useState(false);

  const CAST_LIMIT = 320;
  const LONG_FORM_LIMIT = 10000;

  // Legacy stub — no longer needed, writes go direct via useFarcasterWrites
  const getStoredSignerUuid = (): string | undefined => undefined;

  // Listen for custom event to open compose with pre-filled text
  useEffect(() => {
    const handleOpenCompose = (e: CustomEvent) => {
      const { text: prefilledText, parentCastHash, parentCastFid, replyingToName } = e.detail || {};
      if (prefilledText) setText(prefilledText);
      setReplyParentHash(parentCastHash ?? null);
      setReplyParentFid(parentCastFid ?? null);
      setReplyParentName(replyingToName ?? null);
      setOpen(true);
    };

    window.addEventListener('openComposeModal' as any, handleOpenCompose as EventListener);
    
    return () => {
      window.removeEventListener('openComposeModal' as any, handleOpenCompose as EventListener);
    };
  }, []);

  // Fetch channels when modal opens
  useEffect(() => {
    if (open && userFid) {
      fetchChannels();
    }
  }, [open, userFid]);

  async function fetchChannels() {
    try {
      // Fetch all available channels (not user-specific)
      const response = await fetch('/api/channels?limit=50');
      if (!response.ok) throw new Error(`Channels fetch failed: ${response.status}`);
      const data = await response.json();

      if (data?.ok && Array.isArray(data?.channels)) {
        setChannels(data.channels);
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

  // Search for users when typing @mentions
  useEffect(() => {
    const searchMentions = async () => {
      if (!mentionSearch || mentionSearch.length < 2) {
        setMentionResults([]);
        return;
      }

      try {
        const response = await fetch(`/api/search-users?q=${encodeURIComponent(mentionSearch)}`);
        if (response.ok) {
          const data = await response.json();
          setMentionResults(data.users || []);
        }
      } catch (error) {
        console.error('Error searching users:', error);
      }
    };

    const timeoutId = setTimeout(searchMentions, 300);
    return () => clearTimeout(timeoutId);
  }, [mentionSearch]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setText(newText);

    // Check for @ mention
    const textBeforeCursor = newText.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      // Check if there's a space after @ (which would end the mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt);
        setMentionStartPos(lastAtSymbol);
        setShowMentions(true);
        return;
      }
    }
    
    setShowMentions(false);
    setMentionSearch('');
  };

  // Detect URLs in text and fetch preview
  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex);
    
    if (matches && matches.length > 0) {
      const url = matches[0]; // Take first URL
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

  const insertMention = (user: any) => {
    if (mentionStartPos === null) return;
    
    const beforeMention = text.substring(0, mentionStartPos);
    const afterMention = text.substring(mentionStartPos + mentionSearch.length + 1);
    const newText = `${beforeMention}@${user.username} ${afterMention}`;
    
    setText(newText);
    setShowMentions(false);
    setMentionSearch('');
    setMentionStartPos(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setStatus("Image too large. Maximum size is 10MB.");
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setStatus("Please select an image file.");
      return;
    }

    setUploadingImage(true);
    setStatus("Uploading image...");

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (userFid) formData.append('fid', String(userFid));

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
      const data = await response.json();

      if (data.ok && data.url) {
        setUploadedImage(data.url);
        setImageUrl(data.url);
        setImageProvider(data.provider === 'ipfs' ? 'ipfs' : 'imgbb');
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
    setImageProvider(null);
  };

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
        setStatus("Sign in with Farcaster to post.");
        setLoading(false);
        return;
      }

      console.log("Posting with:", { userFid, hasActiveSigner, text, isScheduled, scheduleTime });

      // In long-form mode only the first 320 chars go to the Farcaster timeline
      const castText = isLongForm ? text.slice(0, CAST_LIMIT) : text;

      // Prepare cast data (for scheduled path)
      const body: any = { text: castText, fid: userFid };

      // Build embeds array
      const embeds: any[] = [];

      // Add image embed if provided
      if (imageUrl.trim()) {
        embeds.push({ url: imageUrl.trim() });
      }

      // Add URL embed if we have a preview (URL is already in the text; just attach as embed)
      if (urlPreview && detectedUrl) {
        embeds.push({ url: detectedUrl });
      }

      if (embeds.length > 0) {
        body.embeds = embeds;
      }

      // Add channel if selected
      if (selectedChannel) {
        body.channelKey = selectedChannel;
        console.log('[ComposeModal] Adding channel to post:', selectedChannel);
      } else {
        console.log('[ComposeModal] No channel selected');
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
        
        console.log('[ComposeModal] Scheduling cast, sending POST to /api/schedule-cast with body:', JSON.stringify(body, null, 2));
        const res = await fetch("/api/schedule-cast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        console.log(`[ComposeModal] Schedule response status: ${res.status} ${res.statusText}`);
        
        let data;
        try {
          data = await res.json();
          console.log('[ComposeModal] Schedule response body:', data);
        } catch (parseErr) {
          console.error('[ComposeModal] Failed to parse schedule response:', parseErr);
          const text = await res.text();
          console.error('[ComposeModal] Raw schedule response:', text);
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
            setOpen(false);
            setStatus(null);
          }, 800);
        } else {
          const errorMsg = data.error || data.message || "unknown error";
          const errorCode = data.code || '';
          const fullError = errorCode ? `${errorMsg} (${errorCode})` : errorMsg;
          console.error('[ComposeModal] Schedule API error:', { status: res.status, error: errorMsg, code: errorCode });
          setStatus(`Failed: ${fullError}. Response status: ${res.status}`);
        }
            } else {
        // Post immediately
        if (replyParentHash && replyParentFid) {
          await reply({
            text: body.text,
            parentCastHash: replyParentHash,
            parentCastFid: replyParentFid,
            embeds: body.embeds,
          });
        } else {
          await submitCast({
            text: body.text,
            embeds: body.embeds,
            channelKey: body.channelKey,
            parentUrl: body.parentUrl,
          });
        }
        setStatus("✓ Posted successfully!");
        setText("");
        setImageUrl("");
        setUploadedImage(null);
        setUrlPreview(null);
        setDetectedUrl(null);
        setReplyParentHash(null);
        setReplyParentFid(null);
        setReplyParentName(null);
        setIsLongForm(false);
        setTimeout(() => {
          setOpen(false);
          setStatus(null);
        }, 800);
      }
    } catch (err: any) {
      setStatus(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!hideFab && (
        <button
          aria-label="Open compose"
          title="Compose"
          onClick={() => setOpen(true)}
          className="btn primary"
          style={{ width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="white" />
            <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="white" />
          </svg>
        </button>
      )}

      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{replyParentName ? `Reply to ${replyParentName}` : 'New Cast'}</h3>
              <div>
                <button className="btn" onClick={() => { setOpen(false); setReplyParentHash(null); setReplyParentFid(null); setReplyParentName(null); }} aria-label="Close">Close</button>
              </div>
            </div>
            {replyParentName && (
              <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginBottom: 8, padding: '4px 0' }}>
                Replying to <strong>{replyParentName}</strong>
              </div>
            )}

            {
              /* Normal compose interface */
              <>
                {/* Long-form toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => setIsLongForm(v => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: isLongForm ? 'rgba(99,102,241,0.15)' : 'var(--surface)',
                      border: `1px solid ${isLongForm ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`,
                      color: isLongForm ? '#a5b4fc' : 'var(--muted-on-dark)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    ✨ Pro · Long Form
                  </button>
                  {isLongForm && (
                    <span style={{ fontSize: 11, color: 'var(--muted-on-dark)' }}>
                      First 320 chars appear in timeline
                    </span>
                  )}
                </div>

                <div style={{ marginTop: 12, position: 'relative' }}>
                  <textarea
                    className="compose-textarea"
                    value={text}
                    onChange={e => {
                      if (e.target.value.length <= (isLongForm ? LONG_FORM_LIMIT : CAST_LIMIT)) {
                        handleTextChange(e);
                      }
                    }}
                    placeholder={isLongForm ? 'Write your long-form cast… (first 320 chars appear in timeline)' : 'Write a cast…'}
                    autoFocus
                    style={{ minHeight: isLongForm ? 180 : undefined }}
                  />
                  
                  {/* Character counter */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {isLongForm && text.length > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--muted-on-dark)' }}>
                        Timeline preview: {Math.min(text.length, CAST_LIMIT)}/{CAST_LIMIT}
                      </span>
                    )}
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: text.length > (isLongForm ? LONG_FORM_LIMIT - 200 : CAST_LIMIT - 40)
                        ? text.length >= (isLongForm ? LONG_FORM_LIMIT : CAST_LIMIT) ? '#ef4444' : '#f59e0b'
                        : 'var(--muted-on-dark)',
                    }}>
                      {text.length}/{isLongForm ? LONG_FORM_LIMIT : CAST_LIMIT}
                    </span>
                  </div>

                  {/* 320-char cutoff marker in long-form mode */}
                  {isLongForm && text.length > CAST_LIMIT && (
                    <div style={{
                      marginTop: 8, padding: '6px 10px', borderRadius: 8,
                      background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)',
                      fontSize: 12, color: '#a5b4fc',
                    }}>
                      <strong>Timeline preview</strong> (first 320 chars):{' '}
                      <span style={{ color: 'var(--muted-on-dark)' }}>
                        {text.slice(0, CAST_LIMIT)}
                      </span>
                    </div>
                  )}

                  {/* Mention autocomplete dropdown */}
                  {showMentions && mentionResults.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      marginTop: '4px',
                      zIndex: 1000,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}>
                      {mentionResults.slice(0, 5).map((user) => (
                        <button
                          key={user.fid}
                          onClick={() => insertMention(user)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {user.pfp_url && (
                            <img 
                              src={user.pfp_url} 
                              alt={user.username}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover'
                              }}
                            />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>
                              {user.display_name}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--muted-on-dark)' }}>
                              @{user.username}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Image upload/URL section */}
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <label
                      htmlFor="image-upload"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        background: 'linear-gradient(180deg, #334155 0%, #1e293b 100%)',
                        color: '#e2e8f0',
                        borderRadius: '8px',
                        cursor: uploadingImage ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        border: '1px solid #475569',
                        opacity: uploadingImage ? 0.6 : 1,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      {uploadingImage ? 'Uploading…' : 'Add Image'}
                    </label>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      style={{ display: 'none' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--muted-on-dark)' }}>
                      or paste URL below
                    </span>
                  </div>
                  
                  {/* Image URL input */}
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setUploadedImage(null);
                    }}
                    placeholder="Or paste image URL here"
                    disabled={uploadingImage}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--foreground)',
                      fontSize: '14px'
                    }}
                  />
                  
                  {/* Image preview */}
                  {imageUrl && (
                    <div style={{ marginTop: 8, position: 'relative' }}>
                      <img
                        src={imageUrl}
                        alt="Preview"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '300px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          display: 'block'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <button
                        onClick={removeImage}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(0, 0, 0, 0.7)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* URL Preview */}
                {loadingPreview && (
                  <div style={{ marginTop: 12, padding: 12, background: 'var(--surface)', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>
                      Loading preview...
                    </div>
                  </div>
                )}
                {urlPreview && urlPreview.metadata && (
                  <div style={{ 
                    marginTop: 12, 
                    padding: 12, 
                    background: 'var(--surface)', 
                    borderRadius: 8,
                    border: '1px solid var(--border)'
                  }}>
                    {urlPreview.metadata.image && (
                      <img 
                        src={urlPreview.metadata.image}
                        alt={urlPreview.metadata.title}
                        style={{
                          width: '100%',
                          height: 'auto',
                          maxHeight: '200px',
                          objectFit: 'cover',
                          borderRadius: 6,
                          marginBottom: 8
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    {urlPreview.metadata.title && (
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: 600, 
                        marginBottom: 4,
                        color: 'var(--foreground)'
                      }}>
                        {urlPreview.metadata.title}
                      </div>
                    )}
                    {urlPreview.metadata.description && (
                      <div style={{ 
                        fontSize: 12, 
                        color: 'var(--muted-on-dark)',
                        marginBottom: 4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {urlPreview.metadata.description}
                      </div>
                    )}
                    {urlPreview.isArticle && urlPreview.articleText && (
                      <div style={{ 
                        fontSize: 11, 
                        color: 'var(--accent)',
                        fontWeight: 500,
                        marginTop: 6
                      }}>
                        📰 Article preview will be added to your cast
                      </div>
                    )}
                    <div style={{ 
                      fontSize: 11, 
                      color: 'var(--muted-on-dark)',
                      marginTop: 6
                    }}>
                      {urlPreview.metadata.siteName || new URL(detectedUrl!).hostname}
                    </div>
                  </div>
                )}
                
                {/* Channel Selection */}
                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: '13px', fontWeight: 500, marginBottom: 6, display: 'block' }}>
                    📺 Post to channel (optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={channelSearch}
                      onChange={(e) => {
                        const value = e.target.value;
                        setChannelSearch(value);
                        setShowChannelSuggestions(true);
                        // If user types just the channel name (without /), set it as selected
                        const cleanValue = value.replace(/^\//, '').split(' - ')[0].trim();
                        if (cleanValue) {
                          setSelectedChannel(cleanValue);
                        } else {
                          setSelectedChannel('');
                        }
                      }}
                      onFocus={() => setShowChannelSuggestions(true)}
                      placeholder="Type channel name (e.g., replyguys, base)"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--foreground)',
                        fontSize: '14px'
                      }}
                    />
                    {showChannelSuggestions && channelSearch && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        marginTop: '4px',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}>
                        {channels
                          .filter(ch => 
                            ch.id?.toLowerCase().includes(channelSearch.toLowerCase()) ||
                            ch.name?.toLowerCase().includes(channelSearch.toLowerCase())
                          )
                          .slice(0, 10)
                          .map((channel) => (
                            <button
                              key={channel.id}
                              onClick={() => {
                                setSelectedChannel(channel.id);
                                setChannelSearch(`/${channel.id}${channel.name ? ` - ${channel.name}` : ''}`);
                                setShowChannelSuggestions(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                textAlign: 'left',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--foreground)',
                                cursor: 'pointer',
                                fontSize: '14px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              /{channel.id} {channel.name && `- ${channel.name}`}
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                  {selectedChannel && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: 4 }}>
                      ✓ Posting to /{selectedChannel}
                    </div>
                  )}
                </div>
                
                {/* Schedule Section */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      id="schedule-toggle"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <label htmlFor="schedule-toggle" style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                      📅 Schedule for later
                    </label>
                  </div>
                  
                  {isScheduled && (
                    <div style={{ position: 'relative' }}>
                      <input
                        type="datetime-local"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        style={{
                          width: '100%',
                          padding: '10px 40px 10px 12px',
                          borderRadius: '8px',
                          border: '2px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--foreground)',
                          fontSize: '15px',
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                      />
                      <svg 
                        style={{ 
                          position: 'absolute', 
                          right: '12px', 
                          top: '50%', 
                          transform: 'translateY(-50%)',
                          pointerEvents: 'none',
                          width: '20px',
                          height: '20px',
                          color: 'var(--muted)'
                        }}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button className="btn" onClick={() => {
                    setOpen(false);
                    setText('');
                    setImageUrl('');
                    setUploadedImage(null);
                    setScheduleTime('');
                    setIsScheduled(false);
                    setIsLongForm(false);
                  }}>Cancel</button>
                  <button
                    className="btn primary"
                    disabled={loading || uploadingImage || (!text.trim() && !imageUrl.trim()) || (isScheduled && !scheduleTime)}
                    onClick={async () => {
                      await handlePost();
                    }}
                  >
                    {loading ? (isScheduled ? "Scheduling…" : "Posting…") : (isScheduled ? "Schedule" : "Post")}
                  </button>
                </div>
                {status && <div style={{ marginTop: 8 }}>{status}</div>}
              </>
            }
          </div>
        </div>
      )}
    </>
  );
}
