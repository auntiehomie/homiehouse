"use client";

import React, { useState } from "react";
import farcaster from "../../lib/farcaster";

export default function ComposePage() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handlePost() {
    setStatus(null);
    setLoading(true);
    try {
      await farcaster.ready();
      const res = await farcaster.postCast(text);
      if (res.ok) setStatus("Posted successfully");
      else setStatus(`Failed: ${res.error}`);
    } catch (err: any) {
      setStatus(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  const capabilities = typeof window !== "undefined" ? farcaster.getCapabilities() : [];

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-black text-black dark:text-white">
      <main className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold mb-4">Compose</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Host capabilities: {capabilities.length ? capabilities.join(", ") : "none detected"}
        </p>

        {/* Compact pencil icon button to open editor */}
        <div className="flex items-center gap-3">
          <button
            aria-label="Open compose"
            title="Compose"
            onClick={() => setOpen(true)}
            className="btn primary"
            style={{ width: 48, height: 48, padding: 0, borderRadius: 12 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="white" />
              <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="white" />
            </svg>
          </button>
          <div className="text-sm">Click the pencil to compose a new cast</div>
        </div>

        {/* Modal editor */}
        {open && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal">
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>New Cast</h3>
                <div>
                  <button className="btn" onClick={() => setOpen(false)} aria-label="Close">Close</button>
                </div>
              </div>
              <div className="modal-body">
                <textarea
                  className="w-full min-h-[120px] p-3 rounded border"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a cast..."
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn primary"
                  disabled={loading || !text.trim()}
                  onClick={async () => {
                    await handlePost();
                    if (!loading) setOpen(false);
                  }}
                >
                  {loading ? "Posting…" : "Post"}
                </button>
              </div>
              {status && <div style={{ marginTop: 8 }}>{status}</div>}
            </div>
          </div>
        )}

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          If posting fails, the host may not support `composeCast`. Use the Dev page to inspect the
          runtime SDK.
        </p>
      </main>
    </div>
  );
}
