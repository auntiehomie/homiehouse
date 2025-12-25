"use client";

import React, { useState } from "react";
import farcaster from "../lib/farcaster";
import { useProfile } from "@farcaster/auth-kit";

export default function ComposeModal() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const { isAuthenticated, profile } = useProfile();

  // Load signer from localStorage on mount
  const getSigner = () => {
    if (!isAuthenticated || !profile?.fid) return null;
    const key = `signer_${profile.fid}`;
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };

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

      const signer = getSigner();
      if (!signer || signer.status !== "approved") {
        setStatus("You need to grant write access first. Use the button at the top of the page.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, signer_uuid: signer.signer_uuid, fid: profile.fid }),
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
