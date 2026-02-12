"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';

export default function ComposePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [signerUuid, setSignerUuid] = useState<string | null>(null);
  const [signerStatus, setSignerStatus] = useState<string | null>(null);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [userFid, setUserFid] = useState<number | null>(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [channels, setChannels] = useState<any[]>([]);
  const [channelSearch, setChannelSearch] = useState<string>('');
  const [showChannelSuggestions, setShowChannelSuggestions] = useState(false);
  const [urlPreview, setUrlPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);

  // Load user profile and signer from localStorage
  useEffect(() => {
    const storedProfile = localStorage.getItem("hh_profile");
    if (storedProfile) {
      try {
        const profile = JSON.parse(storedProfile);
        const fid = profile?.fid;
        setUserFid(fid);
        
        if (fid) {
          const key = `signer_${fid}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              setSignerUuid(parsed.signer_uuid || null);
              setSignerStatus(parsed.status || null);
              setApprovalUrl(parsed.signer_approval_url || null);
              
              // If we have a signer UUID and status is approved, we're ready to post
              if (parsed.signer_uuid && parsed.status === 'approved') {
                console.log('Neynar signer ready:', parsed.signer_uuid);
              }
            } catch {
              // ignore
            }
          }
          
          // Fetch channels
          fetchChannels(fid);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  async function fetchChannels(fid: number) {
    try {
      // Fetch all available channels (not user-specific)
      const response = await fetch('/api/channels?limit=50');
      const data = await response.json();
      
      if (data.ok && data.channels) {
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
      // SECURITY: Include signerUuid for authenticated upload
      if (signerUuid) {
        formData.append('signerUuid', signerUuid);
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

  async function createSigner() {
    if (!userFid) {
      setStatus("Sign in first.");
      return;
    }

    setLoading(true);
    setStatus("Creating signer...");
    try {
      const res = await fetch("/api/signer", { method: "POST" });
      const data = await res.json();

      if (data.ok && data.signer_uuid) {
        setSignerUuid(data.signer_uuid);
        setSignerStatus(data.status);
        setApprovalUrl(data.signer_approval_url);

        const key = `signer_${userFid}`;
        localStorage.setItem(key, JSON.stringify({
          signer_uuid: data.signer_uuid,
          status: data.status,
          signer_approval_url: data.signer_approval_url
        }));

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile && data.signer_approval_url) {
          setStatus("Opening approval page...");
          window.location.href = data.signer_approval_url;
        } else {
          setStatus("Signer created! Approve it to enable posting.");
        }
      } else {
        setStatus(`Failed: ${data.error || "unknown"}`);
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus() {
    if (!signerUuid) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
      const data = await res.json();

      if (data.ok) {
        setSignerStatus(data.status);
        
        if (data.signer_approval_url) {
          setApprovalUrl(data.signer_approval_url);
        }

        if (userFid) {
          const key = `signer_${userFid}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.status = data.status;
            if (data.signer_approval_url) {
              parsed.signer_approval_url = data.signer_approval_url;
            }
            localStorage.setItem(key, JSON.stringify(parsed));
          }
        }

        if (data.status === "approved") {
          setStatus("✓ Signer approved! You can now post.");
        } else {
          setStatus(`Status: ${data.status}`);
        }
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
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

      if (signerStatus !== "approved" && !signerUuid) {
        setStatus("Please create and approve a signer first.");
        setLoading(false);
        return;
      }

      const body: any = { 
        text, 
        signerUuid: signerUuid || undefined,
        fid: userFid 
      };

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
        // Post immediately
        console.log('[ComposePage] Sending POST to /api/privy-compose with body:', JSON.stringify(body, null, 2));
        const res = await fetch("/api/privy-compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        console.log(`[ComposePage] Response status: ${res.status} ${res.statusText}`);
        
        let data;
        try {
          data = await res.json();
          console.log('[ComposePage] Response body:', data);
        } catch (parseErr) {
          console.error('[ComposePage] Failed to parse response as JSON:', parseErr);
          const text = await res.text();
          console.error('[ComposePage] Raw response:', text);
          setStatus(`Server error (${res.status}): Could not parse response. Check console for details.`);
          setLoading(false);
          return;
        }
        
        if (data.ok) {
          setStatus("✓ Posted successfully!");
          setText("");
          setImageUrl("");
          setUploadedImage(null);
          setUrlPreview(null);
          setDetectedUrl(null);
          setTimeout(() => {
            router.push('/');
          }, 800);
        } else {
          const errorMsg = data.error || data.message || "unknown error";
          const errorCode = data.code || '';
          const fullError = errorCode ? `${errorMsg} (${errorCode})` : errorMsg;
          console.error('[ComposePage] API returned error:', { status: res.status, error: errorMsg, code: errorCode });
          setStatus(`Failed: ${fullError}. Response status: ${res.status}`);
        }
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
        {userFid && signerStatus !== "approved" ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-6">🔐</div>
            <h2 className="text-2xl font-bold mb-4">Enable Posting</h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto">
              To post casts from HomieHouse, you need to approve posting permissions. 
              This only needs to be done once.
            </p>
            
            {!signerUuid ? (
              <button 
                className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                onClick={createSigner} 
                disabled={loading}
              >
                {loading ? "Creating..." : "Enable Posting"}
              </button>
            ) : (
              <div>
                {signerStatus !== "approved" && approvalUrl && (
                  <div className="mb-6">
                    <div className="bg-white p-4 rounded-lg inline-block mb-4">
                      <QRCodeSVG value={approvalUrl} size={200} />
                    </div>
                    <p className="text-sm text-zinc-400 mb-4">
                      Scan this QR code or click below to approve:
                    </p>
                    <a 
                      href={approvalUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-block bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-medium transition-colors mb-4"
                    >
                      Approve in Warpcast →
                    </a>
                  </div>
                )}
                <button 
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-lg transition-colors"
                  onClick={checkStatus} 
                  disabled={loading}
                >
                  {loading ? "Checking..." : "Check Approval Status"}
                </button>
                {signerStatus && (
                  <div className="text-sm text-zinc-400 mt-2">
                    Status: {signerStatus}
                  </div>
                )}
              </div>
            )}
            
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
            
            {/* Mention autocomplete dropdown */}
            {showMentions && mentionResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '200px',
                overflowY: 'auto',
                background: '#1a1a1a',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                marginTop: '4px',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
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
                      textAlign: 'left',
                      color: 'white'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#27272a'}
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
                      <div style={{ fontSize: '12px', color: '#71717a' }}>
                        @{user.username}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* Image upload section */}
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <div className="flex gap-3 items-center mb-3">
                <label 
                  htmlFor="image-upload-compose"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                    uploadingImage 
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {uploadingImage ? 'Uploading...' : 'Add Image'}
                </label>
                <input
                  id="image-upload-compose"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  className="hidden"
                />
                <span className="text-xs text-zinc-500">or paste URL</span>
              </div>
              
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setUploadedImage(null);
                }}
                placeholder="Or paste image URL here"
                disabled={uploadingImage}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
              />
              
              {imageUrl && (
                <div className="mt-3 relative">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="max-w-full max-h-64 rounded-lg border border-zinc-800"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <button
                    onClick={removeImage}
                    className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-black/70 hover:bg-black text-white rounded-full transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* URL Preview */}
            {loadingPreview && (
              <div className="mt-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="text-sm text-zinc-500">
                  Loading preview...
                </div>
              </div>
            )}
            {urlPreview && urlPreview.metadata && (
              <div className="mt-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                {urlPreview.metadata.image && (
                  <img 
                    src={urlPreview.metadata.image}
                    alt={urlPreview.metadata.title}
                    className="w-full h-auto max-h-48 object-cover rounded-md mb-2"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                {urlPreview.metadata.title && (
                  <div className="text-sm font-semibold mb-1 text-white">
                    {urlPreview.metadata.title}
                  </div>
                )}
                {urlPreview.metadata.description && (
                  <div className="text-xs text-zinc-400 mb-1 line-clamp-2">
                    {urlPreview.metadata.description}
                  </div>
                )}
                {urlPreview.isArticle && urlPreview.articleText && (
                  <div className="text-xs text-orange-500 font-medium mt-2">
                    📰 Article preview will be added to your cast
                  </div>
                )}
                <div className="text-xs text-zinc-500 mt-2">
                  {urlPreview.metadata.siteName || new URL(detectedUrl!).hostname}
                </div>
              </div>
            )}
            
            {/* Channel Selection */}
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <label className="text-sm font-medium mb-2 block">
                📺 Post to channel (optional)
              </label>
              <div className="relative">
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
                  className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                />
                {showChannelSuggestions && channelSearch && (
                  <div className="absolute top-full left-0 right-0 max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-lg mt-1 z-50 shadow-lg">
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
                          className="w-full px-4 py-2 text-left text-white hover:bg-zinc-800 transition-colors"
                        >
                          /{channel.id} {channel.name && `- ${channel.name}`}
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
              {selectedChannel && (
                <div className="text-xs text-zinc-500 mt-1">
                  ✓ Posting to /{selectedChannel}
                </div>
              )}
            </div>
            
            {/* Schedule Section */}
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="schedule-toggle"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="schedule-toggle" className="text-sm cursor-pointer flex items-center gap-2 font-medium">
                  📅 Schedule for later
                </label>
              </div>
              
              {isScheduled && (
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-2.5 pr-12 bg-zinc-900 border-2 border-zinc-800 rounded-lg text-white focus:outline-none focus:border-zinc-600 cursor-pointer text-[15px]"
                  />
                  <svg 
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-zinc-500">
                {text.length > 0 && `${text.length} characters`}
              </div>
              <div className="flex gap-3">
                <button 
                  className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                  onClick={() => router.back()}
                >
                  Cancel
                </button>
                <button
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || uploadingImage || (!text.trim() && !imageUrl.trim()) || (isScheduled && !scheduleTime)}
                  onClick={handlePost}
                >
                  {loading ? (isScheduled ? "Scheduling..." : "Posting...") : (isScheduled ? "Schedule Cast" : "Post Cast")}
                </button>
              </div>
            </div>
            
            {status && (
              <div className="mt-4 p-3 bg-zinc-900 rounded-lg text-sm">
                {status}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
