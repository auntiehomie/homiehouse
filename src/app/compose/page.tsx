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
        }
      } catch {
        // ignore
      }
    }
  }, []);

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

      if (imageUrl.trim()) {
        body.embeds = [{ url: imageUrl.trim() }];
      }

      const res = await fetch("/api/privy-compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.ok) {
        setStatus("✓ Posted successfully!");
        setText("");
        setImageUrl("");
        setUploadedImage(null);
        setTimeout(() => {
          router.push('/');
        }, 800);
      } else {
        setStatus(`Failed: ${data.error || data.message || "unknown error"}`);
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
                  disabled={loading || uploadingImage || (!text.trim() && !imageUrl.trim())}
                  onClick={handlePost}
                >
                  {loading ? "Posting..." : "Post Cast"}
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
