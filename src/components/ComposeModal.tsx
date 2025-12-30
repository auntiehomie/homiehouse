"use client";

import React, { useState, useEffect } from "react";
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

  // Load signer from localStorage on mount (Neynar signer)
  useEffect(() => {
    if (isAuthenticated && profile?.fid) {
      const key = `signer_${profile.fid}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSignerUuid(parsed.signer_uuid || null);
          setSignerStatus(parsed.status || null);
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
      const res = await fetch("/api/signer", { method: "POST" });
      const data = await res.json();
      console.log("Signer response:", data);

      if (data.ok && data.signer_uuid) {
        const uuid = data.signer_uuid;
        setSignerUuid(uuid);
        setSignerStatus(data.status);
        setApprovalUrl(data.signer_approval_url);

        // Store in localStorage
        const key = `signer_${profile.fid}`;
        localStorage.setItem(key, JSON.stringify({ signer_uuid: uuid, status: data.status }));

        setStatus("Signer created! Scan QR code or click 'Approve Signer'.");
      } else {
        console.error("Signer creation error:", data);
        setStatus(`Failed: ${data.error || "unknown error"}`);
      }
    } catch (e: any) {
      console.error("Signer creation exception:", e);
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
        const newStatus = data.status;
        setSignerStatus(newStatus);

        // Update localStorage
        if (profile?.fid) {
          const key = `signer_${profile.fid}`;
          localStorage.setItem(key, JSON.stringify({ signer_uuid: signerUuid, status: newStatus }));
        }

        if (newStatus === "approved") {
          setStatus("Signer approved! You can now post.");
        } else {
          setStatus(`Signer status: ${newStatus}`);
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

      if (!signerUuid || signerStatus !== "approved") {
        setStatus("You need to approve the signer first.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text, 
          signerUuid,
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
            {isAuthenticated && signerStatus !== "approved" && (
              <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'rgba(251, 146, 60, 0.1)' }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: 'rgb(251, 146, 60)' }}>⚠️ Posting Not Available</div>
                <div style={{ fontSize: 14, color: 'var(--muted-on-dark)', lineHeight: 1.5 }}>
                  To enable posting, you need an approved signer. Please:
                  <ol style={{ marginTop: 8, marginBottom: 8, paddingLeft: 20 }}>
                    <li>Go to <a href="https://warpcast.com/~/developers" target="_blank" rel="noopener noreferrer" style={{ color: 'rgb(251, 146, 60)', textDecoration: 'underline' }}>Warpcast Developer Settings</a></li>
                    <li>Create and approve a signer for this app</li>
                    <li>Or use the NEYNAR_SIGNER_UUID from your .env in development</li>
                  </ol>
                  Alternatively, posting through AuthKit's native flow may be available in a future update.
                </div>
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
