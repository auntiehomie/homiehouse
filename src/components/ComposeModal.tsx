"use client";

import React, { useState, useEffect } from "react";
import farcaster from "../lib/farcaster";
import { useProfile } from "@farcaster/auth-kit";
import { QRCodeSVG } from 'qrcode.react';

export default function ComposeModal() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [signerUuid, setSignerUuid] = useState<string | null>(null);
  const [signerStatus, setSignerStatus] = useState<string | null>(null);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);

  const { isAuthenticated, profile } = useProfile();

  // Load signer from localStorage on mount
  useEffect(() => {
    if (isAuthenticated && profile?.fid) {
      const key = `signer_${profile.fid}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSignerUuid(parsed.signer_uuid || null);
          setSignerStatus(parsed.status || null);
          setApprovalUrl(parsed.approval_url || null);
        } catch {
          // ignore parse errors
        }
      }
    } else {
      setSignerUuid(null);
      setSignerStatus(null);
      setApprovalUrl(null);
    }
  }, [isAuthenticated, profile?.fid]);

  async function createSigner() {
    if (!profile?.fid) {
      setStatus("Sign in first to create a signer.");
      return;
    }

    setLoading(true);
    setStatus("Creating signer...");
    try {
      const res = await fetch("/api/signer", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid: profile.fid })
      });
      const data = await res.json();
      console.log("Signer response:", data);

      if (data.ok) {
        setSignerUuid(data.signer_uuid);
        setSignerStatus(data.status);
        
        const url = data.signer_approval_url || null;
        setApprovalUrl(url);
        console.log("Approval URL:", url);

        const key = `signer_${profile.fid}`;
        localStorage.setItem(key, JSON.stringify({ 
          signer_uuid: data.signer_uuid, 
          status: data.status,
          approval_url: url
        }));

        setStatus(url ? "Signer created. Click 'Approve Signer' to grant permissions." : "Signer created but no approval URL provided.");
      } else {
        setStatus(`Failed to create signer: ${data.error}`);
      }
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function checkSignerStatus() {
    if (!signerUuid) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
      const data = await res.json();

      if (data.ok) {
        setSignerStatus(data.status);
        if (data.status === "approved") {
          const key = `signer_${profile?.fid}`;
          localStorage.setItem(key, JSON.stringify({ signer_uuid: signerUuid, status: "approved" }));
          setStatus("Signer approved! You can now post.");
        } else {
          setStatus(`Signer status: ${data.status}`);
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
      // Try SDK first (local dev)
      await farcaster.ready();
      const sdkRes = await farcaster.postCast(text);
      if (sdkRes.ok) {
        setStatus("Posted successfully");
        setText("");
        setLoading(false);
        return;
      }

      // Fallback to server-side posting
      if (!isAuthenticated || !profile?.fid) {
        setStatus("Sign in to post.");
        setLoading(false);
        return;
      }

      if (!signerUuid || signerStatus !== "approved") {
        setStatus("You need to grant write access first. Create and approve a signer below.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, signer_uuid: signerUuid, fid: profile.fid }),
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
            {isAuthenticated && signerStatus !== "approved" && (
              <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Write Permissions</div>
                {!signerUuid ? (
                  <>
                    <div style={{ marginBottom: 8, fontSize: 14, color: 'var(--muted-on-dark)' }}>
                      To post from this app, create a signer and approve it.
                    </div>
                    <button className="btn" onClick={createSigner} disabled={loading}>
                      {loading ? "Creating…" : "Create Signer"}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 8, fontSize: 14, color: 'var(--muted-on-dark)' }}>
                      Signer status: <strong>{signerStatus}</strong>
                    </div>
                    {approvalUrl ? (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', display: 'inline-block', marginBottom: '12px' }}>
                          <QRCodeSVG value={approvalUrl} size={200} />
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted-on-dark)', marginBottom: 8 }}>
                          Scan this QR code with your phone, or click the button below:
                        </div>
                        <a href={approvalUrl} target="_blank" rel="noopener noreferrer" className="btn primary" style={{ display: 'block', textAlign: 'center' }}>
                          Approve Signer in Warpcast →
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
                            localStorage.removeItem(`signer_${profile.fid}`);
                          }
                          setSignerUuid(null);
                          setSignerStatus(null);
                          setApprovalUrl(null);
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
