"use client";

import { useState, useEffect, useRef } from "react";

export function openMiniApp(url: string, title?: string) {
  window.dispatchEvent(new CustomEvent("hh:open-miniapp", { detail: { url, title } }));
}

function getProfile() {
  try { return JSON.parse(localStorage.getItem('hh_profile') || '{}'); } catch { return {}; }
}

function buildContext(profile: any) {
  return {
    user: {
      fid: profile.fid || 0,
      username: profile.username || '',
      displayName: profile.display_name || profile.username || '',
      pfpUrl: profile.pfp_url || '',
    },
    location: { type: 'cast_embed' },
    client: { clientFid: 0, added: false },
  };
}

// Send context in every known SDK format variant.
// req is the incoming message we're responding to (used to echo id/requestId).
function sendContext(target: Window, context: any, req?: any) {
  const id = req?.id ?? req?.requestId;

  // Type-based (older SDK versions)
  target.postMessage({ type: 'frameContext', data: context }, '*');
  target.postMessage({ type: 'context', data: context }, '*');
  target.postMessage({ type: 'setContext', context }, '*');
  target.postMessage({ type: 'contextResponse', context }, '*');

  // fc-frame / fc-mini-app protocol
  target.postMessage({ type: 'fc-frame', action: 'setContext', context }, '*');
  target.postMessage({ type: 'fc-mini-app', action: 'setContext', context }, '*');

  // JSON-RPC style (current @farcaster/frame-sdk): echo back the id
  if (id !== undefined) {
    target.postMessage({ id, result: context }, '*');
    target.postMessage({ id, result: { context } }, '*');
    target.postMessage({ requestId: id, type: 'contextResponse', context }, '*');
  }
}

export default function MiniAppViewer() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string; title?: string }>).detail;
      setUrl(detail.url);
      setTitle(detail.title || "");
      setLoading(true);
      setOpen(true);
    };
    window.addEventListener("hh:open-miniapp", handler);
    return () => window.removeEventListener("hh:open-miniapp", handler);
  }, []);

  // Farcaster Mini-app SDK host protocol.
  // Handles both old type/action format and current JSON-RPC method/id format.
  useEffect(() => {
    if (!open) return;

    const handleFrameMessage = (e: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      // Only handle messages originating from our iframe
      if (!e.source || e.source !== iframe.contentWindow) return;

      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;

      const context = buildContext(getProfile());

      // Detect ready / context-request in all known formats
      const isReady =
        msg.type === 'frameReady' ||
        msg.type === 'ready' ||
        msg.type === 'frame:ready' ||
        msg.method === 'ready' ||
        msg.method === 'fc_ready' ||
        msg.method === 'getContext' ||
        msg.method === 'fc_getContext' ||
        (msg.type === 'fc-frame' && (msg.action === 'ready' || msg.action === 'getContext')) ||
        (msg.type === 'fc-mini-app' && (msg.action === 'ready' || msg.action === 'getContext'));

      if (isReady) sendContext(iframe.contentWindow, context, msg);

      const isClose =
        msg.type === 'frameClose' ||
        msg.type === 'close' ||
        (msg.type === 'fc-frame' && msg.action === 'close') ||
        (msg.type === 'fc-mini-app' && msg.action === 'close');
      if (isClose) setOpen(false);

      const isOpenUrl =
        msg.type === 'openUrl' ||
        (msg.type === 'fc-frame' && msg.action === 'openUrl') ||
        (msg.type === 'fc-mini-app' && msg.action === 'openUrl');
      if (isOpenUrl && msg.url) window.open(msg.url, '_blank');
    };

    window.addEventListener('message', handleFrameMessage);
    return () => window.removeEventListener('message', handleFrameMessage);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  let hostname = url;
  try { hostname = new URL(url).hostname; } catch {}

  const handleIframeLoad = () => {
    setLoading(false);
    // Proactively push context before the mini-app even sends 'ready',
    // covering SDKs that resolve context from the first available message.
    const target = iframeRef.current?.contentWindow;
    if (target) sendContext(target, buildContext(getProfile()));
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "var(--bg-dark)",
        display: "flex", flexDirection: "column",
        animation: "hhSlideUp 0.22s ease-out",
      }}
    >
      <style>{`
        @keyframes hhSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        flexShrink: 0,
      }}>
        <button
          onClick={() => setOpen(false)}
          style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.1)", border: "none",
            color: "var(--text-on-dark)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "var(--text-on-dark)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {title || hostname}
          </div>
          {title && (
            <div style={{ fontSize: 11, color: "var(--muted-on-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {hostname}
            </div>
          )}
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "6px 10px", borderRadius: 8,
            background: "rgba(255,255,255,0.08)", border: "none",
            color: "var(--muted-on-dark)", fontSize: 12,
            textDecoration: "none", flexShrink: 0,
          }}
          title="Open in browser"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Browser
        </a>
      </div>

      {loading && (
        <div style={{ height: 2, background: "var(--border)", flexShrink: 0, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: "40%", background: "var(--accent)",
            animation: "hhProgress 1.2s ease-in-out infinite",
          }} />
          <style>{`
            @keyframes hhProgress {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(350%); }
            }
          `}</style>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={url}
        onLoad={handleIframeLoad}
        style={{ flex: 1, border: "none", width: "100%", background: "#fff" }}
        allow="camera; microphone; clipboard-write; payment"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        title={title || hostname}
      />
    </div>
  );
}
