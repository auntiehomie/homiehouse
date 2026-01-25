"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';

export default function ComposeModal() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [signerUuid, setSignerUuid] = useState<string | null>(null);
  const [signerStatus, setSignerStatus] = useState<string | null>(null);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [userFid, setUserFid] = useState<number | null>(null);

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

  // Reload signer data when modal opens (important for mobile)
  useEffect(() => {
    if (open && userFid) {
      const key = `signer_${userFid}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSignerUuid(parsed.signer_uuid || null);
          setSignerStatus(parsed.status || null);
          setApprovalUrl(parsed.signer_approval_url || null);
        } catch {
          // ignore
        }
      }
    }
  }, [open, userFid]);

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
      console.log("Signer response:", data);

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

        // On mobile, automatically open approval link
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
        
        // Update approval URL if returned
        if (data.signer_approval_url) {
          setApprovalUrl(data.signer_approval_url);
        }

        if (userFid) {
          const key = `signer_${userFid}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.status = data.status;
            // Preserve approval URL
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

      // Check if signer is approved
      if (signerStatus !== "approved" && !signerUuid) {
        setStatus("Please create and approve a signer first.");
        setLoading(false);
        return;
      }

      console.log("Posting with:", { userFid, signerUuid, signerStatus, text });

      // Use user's signer or fallback to env
      const res = await fetch("/api/privy-compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text, 
          signerUuid: signerUuid || undefined,
          fid: userFid 
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setStatus("✓ Posted successfully!");
        setText("");
        // Close modal after brief delay to show success message
        setTimeout(() => {
          setOpen(false);
          setStatus(null);
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
    <>
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

      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>New Cast</h3>
              <div>
                <button className="btn" onClick={() => setOpen(false)} aria-label="Close">Close</button>
              </div>
            </div>

            {/* Show approval screen if signer not approved */}
            {userFid && signerStatus !== "approved" ? (
              <div style={{ marginTop: 24 }}>
                <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
                    Enable Posting
                  </h3>
                  <p style={{ color: 'var(--muted-on-dark)', marginBottom: 24, lineHeight: 1.6 }}>
                    To post casts from HomieHouse, you need to approve posting permissions. 
                    This only needs to be done once.
                  </p>
                  
                  {!signerUuid ? (
                    <button 
                      className="btn primary" 
                      onClick={createSigner} 
                      disabled={loading}
                      style={{ width: '100%', padding: '12px', fontSize: 16 }}
                    >
                      {loading ? "Creating..." : "Enable Posting"}
                    </button>
                  ) : (
                    <>
                      {signerStatus !== "approved" && (
                        <div style={{ marginBottom: 16 }}>
                          {approvalUrl ? (
                            <>
                              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', display: 'inline-block', marginBottom: '12px' }}>
                                <QRCodeSVG value={approvalUrl} size={200} />
                              </div>
                              <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', marginBottom: 12 }}>
                                Scan this QR code or click below to approve:
                              </p>
                              <a 
                                href={approvalUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="btn primary" 
                                style={{ display: 'block', textAlign: 'center', marginBottom: 12, padding: '12px', width: '100%' }}
                              >
                                Approve in Warpcast →
                              </a>
                            </>
                          ) : (
                            <div style={{ 
                              padding: '12px', 
                              background: 'rgba(232, 119, 34, 0.1)', 
                              borderRadius: '8px', 
                              marginBottom: '12px',
                              fontSize: '14px',
                              color: 'var(--muted-on-dark)'
                            }}>
                              Approval URL not found. Try creating a new signer.
                            </div>
                          )}
                        </div>
                      )}
                      <button 
                        className="btn" 
                        onClick={checkStatus} 
                        disabled={loading}
                        style={{ width: '100%', padding: '12px', marginBottom: '8px' }}
                      >
                        {loading ? "Checking..." : "Check Approval Status"}
                      </button>
                      {signerStatus && (
                        <div style={{ 
                          fontSize: '13px', 
                          color: 'var(--muted-on-dark)', 
                          textAlign: 'center',
                          padding: '8px'
                        }}>
                          Status: {signerStatus}
                        </div>
                      )}
                    </>
                  )}
                  
                  {status && (
                    <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'var(--surface)', fontSize: 14 }}>
                      {status}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Normal compose interface */
              <>
                <div style={{ marginTop: 16 }}>
                  <textarea
                    className="compose-textarea"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Write a cast..."
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
                  <button
                    className="btn primary"
                    disabled={loading || !text.trim()}
                    onClick={async () => {
                      await handlePost();
                    }}
                  >
                    {loading ? "Posting…" : "Post"}
                  </button>
                </div>
                {status && <div style={{ marginTop: 8 }}>{status}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
