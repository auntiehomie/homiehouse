"use client";

import React, { useState, useEffect } from "react";
import { useProfile } from "@farcaster/auth-kit";
import { QRCodeSVG } from 'qrcode.react';

export default function ComposeModal() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [signerState, setSignerState] = useState<string | null>(null);
  const [deeplinkUrl, setDeeplinkUrl] = useState<string | null>(null);

  const { isAuthenticated, profile } = useProfile();

  // Load signer from localStorage on mount
  useEffect(() => {
    if (isAuthenticated && profile?.fid) {
      const key = `farcaster_signer_${profile.fid}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setToken(parsed.token || null);
          setPrivateKey(parsed.privateKey || null);
          setPublicKey(parsed.publicKey || null);
          setSignerState(parsed.state || null);
          setDeeplinkUrl(parsed.deeplinkUrl || null);
        } catch {
          // ignore parse errors
        }
      }
    } else {
      setToken(null);
      setPrivateKey(null);
      setPublicKey(null);
      setSignerState(null);
      setDeeplinkUrl(null);
    }
  }, [isAuthenticated, profile?.fid]);

  async function createSigner() {
    if (!profile?.fid) {
      setStatus("Sign in first to create a signer.");
      return;
    }

    setLoading(true);
    setStatus("Creating signer request...");
    try {
      const res = await fetch("/api/signer-request", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid: profile.fid })
      });
      const data = await res.json();
      console.log("Signer request response:", data);

      if (data.ok) {
        setToken(data.token);
        setPrivateKey(data.privateKey);
        setPublicKey(data.publicKey);
        setSignerState(data.state);
        setDeeplinkUrl(data.deeplinkUrl);

        const key = `farcaster_signer_${profile.fid}`;
        localStorage.setItem(key, JSON.stringify({ 
          token: data.token,
          privateKey: data.privateKey,
          publicKey: data.publicKey,
          state: data.state,
          deeplinkUrl: data.deeplinkUrl
        }));

        setStatus("Signer request created. Scan QR code or click 'Approve in Warpcast'.");
      } else {
        setStatus(`Failed to create signer request: ${data.error}`);
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function checkSignerStatus() {
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/signer-request?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (data.ok) {
        setSignerState(data.state);
        if (data.state === "completed") {
          const key = `farcaster_signer_${profile?.fid}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.state = "completed";
            localStorage.setItem(key, JSON.stringify(parsed));
          }
          setStatus("Signer approved! You can now post.");
        } else {
          setStatus(`Signer status: ${data.state}`);
        }
      } else {
        setStatus(`Error checking status: ${data.error}`);
      }
    } catch (e: any) {
      setStatus(`Error checking status: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handlePost() {
    setStatus(null);
    setLoading(true);
    try {
      if (!isAuthenticated || !profile?.fid) {
        setStatus("Sign in to post.");
        setLoading(false);
        return;
      }

      if (!privateKey || signerState !== "completed") {
        setStatus("You need to approve the signer first.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text, 
          privateKey,
          fid: profile.fid 
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setStatus("Posted successfully!");
        setText("");
      } else {
        setStatus(`Failed: ${data.error || "unknown error"}`);
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
            <div style={{ marginTop: 8 }}>
              <textarea
                className="w-full min-h-[120px] p-3 rounded border"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a cast..."
              />
            </div>
            {isAuthenticated && signerState !== "completed" && (
              <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Write Permissions</div>
                {!token ? (
                  <>
                    <div style={{ marginBottom: 8, fontSize: 14, color: 'var(--muted-on-dark)' }}>
                      To post from this app, create a signer and approve it in Warpcast.
                    </div>
                    <button className="btn" onClick={createSigner} disabled={loading}>
                      {loading ? "Creating…" : "Create Signer"}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 8, fontSize: 14, color: 'var(--muted-on-dark)' }}>
                      Signer status: <strong>{signerState}</strong>
                    </div>
                    {deeplinkUrl ? (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', display: 'inline-block', marginBottom: '12px' }}>
                          <QRCodeSVG value={deeplinkUrl} size={200} />
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted-on-dark)', marginBottom: 8 }}>
                          Scan this QR code with your phone, or click the button below:
                        </div>
                        <a href={deeplinkUrl} target="_blank" rel="noopener noreferrer" className="btn primary" style={{ display: 'block', textAlign: 'center' }}>
                          Approve in Warpcast →
                        </a>
                      </div>
                    ) : (
                      <div style={{ marginBottom: 8, fontSize: 13, color: '#ef4444' }}>
                        No approval URL available. Try creating a new signer.
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={checkSignerStatus} disabled={loading}>
                        {loading ? "Checking…" : "Check Status"}
                      </button>
                      <button 
                        className="btn" 
                        onClick={() => {
                          if (profile?.fid) {
                            localStorage.removeItem(`farcaster_signer_${profile.fid}`);
                          }
                          setToken(null);
                          setPrivateKey(null);
                          setPublicKey(null);
                          setSignerState(null);
                          setDeeplinkUrl(null);
                          setStatus("Signer cleared. Create a new one.");
                        }}
                        style={{ background: '#ef4444', color: 'white' }}
                      >
                        Reset Signer
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
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
          </div>
        </div>
      )}
    </>
  );
}
