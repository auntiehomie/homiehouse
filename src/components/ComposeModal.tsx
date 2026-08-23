"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFarcasterWrites } from "@/hooks/useFarcasterWrites";
import { usePrivy } from "@privy-io/react-auth";
import Image from "next/image";

const FAB_HIDDEN_PATHS = ['/learn', '/compose', '/settings'];

// Module-level cache so channels are fetched once per session, not on every modal open
let cachedChannels: any[] | null = null;

/** Split long text into thread-sized chunks at natural break points. */
function splitIntoThread(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let remaining = text.trim();

  while (remaining.length > limit) {
    const half = Math.floor(limit / 2);
    // Prefer paragraph → line → sentence → word boundary
    const candidates = [
      remaining.lastIndexOf('\n\n', limit),
      remaining.lastIndexOf('\n', limit),
      Math.max(
        remaining.lastIndexOf('. ', limit),
        remaining.lastIndexOf('! ', limit),
        remaining.lastIndexOf('? ', limit),
      ),
      remaining.lastIndexOf(' ', limit),
    ];
    const splitAt = candidates.find(i => i > half) ?? limit;
    parts.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) parts.push(remaining);
  return parts;
}

export default function ComposeModal() {
  const pathname = usePathname();
  const hideFab = FAB_HIDDEN_PATHS.some(p => pathname === p || pathname?.startsWith(p + '/'));
  const { user, getAccessToken } = usePrivy();
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
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  const CAST_LIMIT = 320;
  const LONG_FORM_LIMIT = 10000;
  const THREAD_MAX = CAST_LIMIT * 10; // up to ~10 casts per thread

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

  const FALLBACK_CHANNELS = [
    { id: 'base', name: 'Base' },
    { id: 'farcaster', name: 'Farcaster' },
    { id: 'dev', name: 'Dev' },
    { id: 'art', name: 'Art' },
    { id: 'music', name: 'Music' },
  ];

  // Check for saved draft when modal opens with no pre-filled text
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem('hh_compose_draft');
      if (raw && !text) {
        const draft = JSON.parse(raw);
        if (draft.text) setHasDraft(true);
      }
    } catch {}
  }, [open]);

  // Fetch channels when modal first opens — cached in module scope for the session
  useEffect(() => {
    if (!open || !userFid) return;
    if (cachedChannels) { setChannels(cachedChannels); return; }
    fetch('/api/channels?limit=50')
      .then(r => r.json())
      .then(data => {
        const list = (data?.ok && Array.isArray(data?.channels)) ? data.channels : FALLBACK_CHANNELS;
        cachedChannels = list;
        setChannels(list);
      })
      .catch(() => setChannels(FALLBACK_CHANNELS));
  }, [open, userFid]);

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

      // Split into thread parts (long-form also threads instead of truncating)
      const threadParts = splitIntoThread(text.trim(), CAST_LIMIT);
      const castText = threadParts[0];

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
        
        const token = await getAccessToken();
        console.log('[ComposeModal] Scheduling cast, sending POST to /api/schedule-cast with body:', JSON.stringify(body, null, 2));
        const res = await fetch("/api/schedule-cast", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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
        // Post immediately — single cast or auto-thread
        const isThread = threadParts.length > 1;
        if (isThread) setStatus(`Posting thread (1/${threadParts.length})…`);

        // Post first part
        let prevHash: string;
        if (replyParentHash && replyParentFid) {
          const { castHash } = await reply({
            text: threadParts[0],
            parentCastHash: replyParentHash,
            parentCastFid: replyParentFid,
            embeds: body.embeds,
          });
          prevHash = castHash;
        } else {
          const { castHash } = await submitCast({
            text: threadParts[0],
            embeds: body.embeds,
            channelKey: body.channelKey,
            parentUrl: body.parentUrl,
          });
          prevHash = castHash;
        }

        // Chain remaining parts as self-replies
        for (let i = 1; i < threadParts.length; i++) {
          setStatus(`Posting thread (${i + 1}/${threadParts.length})…`);
          const { castHash } = await reply({
            text: threadParts[i],
            parentCastHash: prevHash,
            parentCastFid: userFid!,
          });
          prevHash = castHash;
        }

        setStatus(isThread ? `✓ Thread posted (${threadParts.length} casts)!` : "✓ Posted successfully!");
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

  const toolBtn: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 8, background: 'none', border: 'none',
    color: 'var(--muted-on-dark)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center',
  };

  function saveDraft() {
    if (!text.trim()) return;
    localStorage.setItem('hh_compose_draft', JSON.stringify({
      text,
      imageUrl,
      selectedChannel,
      timestamp: Date.now(),
    }));
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem('hh_compose_draft');
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.text) setText(draft.text);
      if (draft.imageUrl) setImageUrl(draft.imageUrl);
      if (draft.selectedChannel) setSelectedChannel(draft.selectedChannel);
    } catch {}
    setHasDraft(false);
  }

  function dismissDraft() {
    localStorage.removeItem('hh_compose_draft');
    setHasDraft(false);
  }

  function doClose() {
    setShowDraftDialog(false);
    setHasDraft(false);
    setOpen(false);
    setText('');
    setImageUrl('');
    setUploadedImage(null);
    setScheduleTime('');
    setIsScheduled(false);
    setIsLongForm(false);
    setReplyParentHash(null);
    setReplyParentFid(null);
    setReplyParentName(null);
  }

  function closeModal() {
    if (text.trim() && !showDraftDialog) {
      setShowDraftDialog(true);
      return;
    }
    doClose();
  }

  const canPost = !loading && !uploadingImage && (!!text.trim() || !!imageUrl.trim()) && (!isScheduled || !!scheduleTime);

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
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)', color: 'var(--text-on-dark)', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-on-dark)', display: 'flex' }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-on-dark)' }}>
              {replyParentName ? `Reply to ${replyParentName}` : 'New Cast'}
            </h1>
            <div style={{ width: 22 }} />
          </div>

          {/* Scrollable body — minHeight:0 prevents iOS Safari flex overflow bug */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px 0' }}>
            {replyParentName && (
              <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', marginBottom: 10 }}>
                Replying to <strong style={{ color: 'var(--text-on-dark)' }}>@{replyParentName}</strong>
              </div>
            )}

            {/* Draft restore banner */}
            {hasDraft && !text && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', marginBottom: 10, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10 }}>
                <span style={{ fontSize: 13, color: '#a78bfa' }}>You have a saved draft</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={restoreDraft} style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Restore</button>
                  <button onClick={dismissDraft} style={{ fontSize: 12, color: 'var(--muted-on-dark)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Discard</button>
                </div>
              </div>
            )}

            {/* Long-form toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <button
                onClick={() => setIsLongForm(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: isLongForm ? 'rgba(99,102,241,0.15)' : 'var(--surface)', border: `1px solid ${isLongForm ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`, color: isLongForm ? '#a5b4fc' : 'var(--muted-on-dark)', cursor: 'pointer' }}
              >
                ✨ Pro · Long Form
              </button>
              {isLongForm && <span style={{ fontSize: 11, color: 'var(--muted-on-dark)' }}>First 320 chars appear in timeline</span>}
            </div>

            {/* Textarea */}
            <div style={{ position: 'relative' }}>
              <textarea
                value={text}
                onChange={e => { if (e.target.value.length <= (isLongForm ? LONG_FORM_LIMIT : THREAD_MAX)) handleTextChange(e); }}
                placeholder={isLongForm ? 'Write your long-form cast…' : "What's on your mind?"}
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-on-dark)', fontSize: 16, padding: '14px', lineHeight: 1.6, border: '1px solid var(--border)', borderRadius: 12, outline: 'none', resize: 'none', minHeight: isLongForm ? 180 : 130, fontFamily: 'inherit' }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />

              {/* Char count — near limit only */}
              {text.length > 260 && (
                <div style={{ textAlign: 'right', marginTop: 4, fontSize: 12, color: text.length > (isLongForm ? LONG_FORM_LIMIT - 200 : CAST_LIMIT - 40) ? (text.length >= (isLongForm ? LONG_FORM_LIMIT : CAST_LIMIT) ? '#ef4444' : '#f59e0b') : 'var(--muted-on-dark)' }}>
                  {text.length}/{isLongForm ? LONG_FORM_LIMIT : CAST_LIMIT}
                </div>
              )}

              {/* Long-form cutoff preview */}
              {isLongForm && text.length > CAST_LIMIT && (
                <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)', fontSize: 12, color: '#a5b4fc' }}>
                  <strong>Timeline preview</strong>: <span style={{ color: 'var(--muted-on-dark)' }}>{text.slice(0, CAST_LIMIT)}</span>
                </div>
              )}

              {/* Mention autocomplete */}
              {showMentions && mentionResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 200, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  {mentionResults.slice(0, 5).map(user => (
                    <button key={user.fid} onClick={() => insertMention(user)} style={{ width: '100%', padding: 12, display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {user.pfp_url && <Image src={user.pfp_url} alt={user.username} width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
                      <div><div style={{ fontWeight: 600, fontSize: 14 }}>{user.display_name}</div><div style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>@{user.username}</div></div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} style={{ display: 'none' }} />

            {/* Image preview */}
            {imageUrl && (
              <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
                <img src={imageUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
                <button onClick={() => { setImageUrl(''); setUploadedImage(null); }} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✕</button>
              </div>
            )}

            {/* URL Preview */}
            {(loadingPreview || urlPreview?.metadata) && (
              <div style={{ marginTop: 10, padding: 12, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {loadingPreview ? (
                  <div style={{ fontSize: 13, color: 'var(--muted-on-dark)' }}>Loading preview…</div>
                ) : urlPreview?.metadata && (
                  <>
                    {urlPreview.metadata.image && <img src={urlPreview.metadata.image} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />}
                    {urlPreview.metadata.title && <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{urlPreview.metadata.title}</div>}
                    {urlPreview.metadata.description && <div style={{ fontSize: 12, color: 'var(--muted-on-dark)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{urlPreview.metadata.description}</div>}
                    <div style={{ fontSize: 11, color: 'var(--muted-on-dark)', marginTop: 6 }}>{urlPreview.metadata.siteName || (detectedUrl ? new URL(detectedUrl).hostname : '')}</div>
                  </>
                )}
              </div>
            )}

            {/* Schedule picker (when active) */}
            {isScheduled && (
              <div style={{ marginTop: 10 }}>
                <input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} min={new Date().toISOString().slice(0, 16)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-on-dark)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            )}

            {status && <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--muted-on-dark)' }}>{status}</div>}

            {/* Bottom breathing room so toolbar doesn't cover content */}
            <div style={{ height: 72 }} />
          </div>

          {/* Save draft dialog */}
          {showDraftDialog && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)' }}>
              <div style={{ width: '100%', background: 'var(--bg-dark)', borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))' }}>
                <p style={{ margin: '0 0 16px', fontWeight: 700, fontSize: 16, textAlign: 'center' }}>Save draft?</p>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted-on-dark)', textAlign: 'center' }}>Your cast will be saved so you can finish it later.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={() => { saveDraft(); doClose(); }} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'var(--btn-primary-bg, #fff)', color: 'var(--btn-primary-color, #000)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Save draft</button>
                  <button onClick={doClose} style={{ width: '100%', padding: '13px', borderRadius: 12, border: '1px solid var(--border)', background: 'none', color: '#ef4444', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Discard</button>
                  <button onClick={() => setShowDraftDialog(false)} style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'none', color: 'var(--muted-on-dark)', fontSize: 15, cursor: 'pointer' }}>Keep editing</button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom toolbar — same pattern as compose page */}
          <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0, position: 'relative' }}>
            {/* Channel picker (opens upward) */}
            {showChannelSuggestions && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, maxHeight: 220, overflowY: 'auto', background: 'var(--bg-dark)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '12px 12px 0 0', boxShadow: '0 -4px 24px rgba(0,0,0,0.5)', zIndex: 50 }}>
                <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
                  <input type="text" value={channelSearch} onChange={e => setChannelSearch(e.target.value)} placeholder="Search channels…" autoFocus style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-on-dark)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                </div>
                {channels.filter(ch => !channelSearch || ch.id?.toLowerCase().includes(channelSearch.toLowerCase()) || ch.name?.toLowerCase().includes(channelSearch.toLowerCase())).slice(0, 8).map(ch => (
                  <button key={ch.id} onClick={() => { setSelectedChannel(ch.id); setChannelSearch(''); setShowChannelSuggestions(false); }} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, color: 'var(--text-on-dark)', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <span style={{ color: 'var(--muted-on-dark)' }}>/</span>{ch.id}{ch.name && <span style={{ color: 'var(--muted-on-dark)', marginLeft: 8, fontSize: 12 }}>{ch.name}</span>}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', boxSizing: 'border-box', width: '100%', overflow: 'hidden' }}>
              {/* Left: scrollable tools */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto', flex: 1, minWidth: 0, scrollbarWidth: 'none' }}>
                <label htmlFor="image-upload" style={{ ...toolBtn, cursor: uploadingImage ? 'not-allowed' : 'pointer', opacity: uploadingImage ? 0.4 : 1 }} title="Add photo">
                  {uploadingImage
                    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity=".75"/></svg>
                    : <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  }
                </label>

                <button onClick={() => setShowChannelSuggestions(!showChannelSuggestions)} title="Post to channel" style={{ ...toolBtn, gap: 4, paddingLeft: 10, paddingRight: 10, background: selectedChannel ? 'rgba(255,255,255,0.1)' : 'none', color: selectedChannel ? 'var(--text-on-dark)' : 'var(--muted-on-dark)' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>#</span>
                  <span style={{ fontSize: 13 }}>{selectedChannel || 'Channel'}</span>
                  {selectedChannel && <span role="button" onClick={e => { e.stopPropagation(); setSelectedChannel(''); setChannelSearch(''); }} style={{ marginLeft: 2, color: 'var(--muted-on-dark)' }}>×</span>}
                </button>

                <button onClick={() => setIsScheduled(!isScheduled)} title="Schedule this cast" style={{ ...toolBtn, background: isScheduled ? 'rgba(255,255,255,0.1)' : 'none', color: isScheduled ? 'var(--text-on-dark)' : 'var(--muted-on-dark)' }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
              </div>

              {/* Right: char count + thread indicator + Post/Schedule */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingLeft: 8 }}>
                {!isLongForm && text.length > CAST_LIMIT ? (
                  <span style={{ fontSize: 12, color: '#a78bfa', whiteSpace: 'nowrap' }}>
                    🧵 {splitIntoThread(text.trim(), CAST_LIMIT).length} casts
                  </span>
                ) : text.length > 260 && (
                  <span style={{ fontSize: 12, color: text.length >= (isLongForm ? LONG_FORM_LIMIT : CAST_LIMIT) ? '#ef4444' : text.length > (isLongForm ? LONG_FORM_LIMIT - 200 : CAST_LIMIT - 40) ? '#f59e0b' : 'var(--muted-on-dark)', minWidth: 28, textAlign: 'right' }}>
                    {text.length}
                  </span>
                )}
                <button
                  onClick={async () => { await handlePost(); }}
                  disabled={!canPost}
                  style={{ padding: '7px 14px', borderRadius: 24, border: 'none', cursor: canPost ? 'pointer' : 'default', background: 'var(--btn-primary-bg, #fff)', color: 'var(--btn-primary-color, #000)', fontSize: 13, fontWeight: 700, opacity: canPost ? 1 : 0.35, whiteSpace: 'nowrap' }}
                >
                  {loading ? '…' : isScheduled ? 'Schedule' : (!isLongForm && text.length > CAST_LIMIT ? 'Post thread' : 'Post')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
