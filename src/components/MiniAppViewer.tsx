"use client";

import { useState, useEffect, useRef } from "react";

export function openMiniApp(url: string, title?: string) {
  window.dispatchEvent(new CustomEvent("hh:open-miniapp", { detail: { url, title } }));
}

function getProfile() {
  try { return JSON.parse(localStorage.getItem('hh_profile') || '{}'); } catch { return {}; }
}

function getWalletAddress(): string {
  const p = getProfile();
  return p.custody_address
    || p.verified_addresses?.eth_addresses?.[0]
    || '';
}

function buildContext(profile: any) {
  return {
    user: {
      fid: profile.fid || 0,
      username: profile.username || '',
      displayName: profile.displayName || profile.display_name || profile.username || '',
      pfpUrl: profile.pfpUrl || profile.pfp_url || '',
    },
    location: { type: 'cast_embed' },
    client: { clientFid: 0, added: false },
  };
}

// Send Farcaster context in every known SDK format variant.
function sendContext(target: Window, context: any, req?: any) {
  const id = req?.id ?? req?.requestId;

  target.postMessage({ type: 'frameContext', data: context }, '*');
  target.postMessage({ type: 'context', data: context }, '*');
  target.postMessage({ type: 'setContext', context }, '*');
  target.postMessage({ type: 'contextResponse', context }, '*');
  target.postMessage({ type: 'fc-frame', action: 'setContext', context }, '*');
  target.postMessage({ type: 'fc-mini-app', action: 'setContext', context }, '*');

  if (id !== undefined) {
    target.postMessage({ id, result: context }, '*');
    target.postMessage({ id, result: { context } }, '*');
    target.postMessage({ requestId: id, type: 'contextResponse', context }, '*');
  }
}

// EIP-1193 wallet provider: handle JSON-RPC wallet calls from the mini-app.
// Returns true if the message was handled as a wallet call.
function handleWalletRpc(target: Window, msg: any): boolean {
  const method: string | undefined = msg.method
    ?? (msg.type === 'fc-frame' || msg.type === 'fc-mini-app' ? msg.action : undefined);

  if (!method) return false;

  const ETH_METHODS = new Set([
    'eth_requestAccounts', 'eth_accounts', 'eth_chainId', 'net_version',
    'eth_getBalance', 'eth_blockNumber', 'eth_gasPrice',
    'wallet_switchEthereumChain', 'wallet_addEthereumChain',
    'wallet_getPermissions', 'wallet_requestPermissions',
    'personal_sign', 'eth_sign', 'eth_signTypedData',
    'eth_signTypedData_v3', 'eth_signTypedData_v4',
    'eth_sendTransaction', 'eth_sendRawTransaction',
  ]);

  if (!ETH_METHODS.has(method)) return false;

  const id = msg.id ?? msg.requestId;
  const address = getWalletAddress();

  let result: any;
  let error: any;

  switch (method) {
    case 'eth_requestAccounts':
    case 'eth_accounts':
      result = address ? [address.toLowerCase()] : [];
      break;

    case 'eth_chainId':
      result = '0x2105'; // Base mainnet
      break;

    case 'net_version':
      result = '8453'; // Base mainnet
      break;

    case 'eth_getBalance':
      result = '0x0';
      break;

    case 'eth_blockNumber':
      result = '0x0';
      break;

    case 'eth_gasPrice':
      result = '0x3B9ACA00'; // 1 gwei
      break;

    case 'wallet_switchEthereumChain':
    case 'wallet_addEthereumChain':
    case 'wallet_getPermissions':
    case 'wallet_requestPermissions':
      result = null;
      break;

    // Signing and transactions require a real signer — not supported inline.
    // Return a user-rejection error so the app can show its own fallback.
    case 'personal_sign':
    case 'eth_sign':
    case 'eth_signTypedData':
    case 'eth_signTypedData_v3':
    case 'eth_signTypedData_v4':
    case 'eth_sendTransaction':
    case 'eth_sendRawTransaction':
      error = { code: 4001, message: 'HomieHouse does not support signing yet — open in browser to sign.' };
      break;

    default:
      error = { code: 4200, message: `Method ${method} not supported` };
  }

  if (id !== undefined) {
    if (error) {
      target.postMessage({ id, error }, '*');
    } else {
      target.postMessage({ id, result }, '*');
    }
  }

  return true;
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

  // Farcaster Mini-app SDK host protocol + EIP-1193 wallet provider.
  useEffect(() => {
    if (!open) return;

    const handleFrameMessage = (e: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      if (!e.source || e.source !== iframe.contentWindow) return;

      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;

      const target = iframe.contentWindow;
      const profile = getProfile();
      const context = buildContext(profile);

      // --- Comlink protocol (used by @farcaster/miniapp-sdk via comlink.wrap) ---
      // Messages: { id, type: 'GET'|'APPLY'|'RELEASE', path: string[], argumentList?: WireValue[] }
      // Response: { id, type: 'RAW', value: <result> }
      const COMLINK_CALL_TYPES = new Set(['GET', 'SET', 'APPLY', 'CONSTRUCT', 'ENDPOINT', 'RELEASE']);
      if (msg.id && COMLINK_CALL_TYPES.has(msg.type) && Array.isArray(msg.path)) {
        const path: string[] = msg.path;
        const prop = path[path.length - 1] ?? '';
        const comlinkRespond = (value: unknown) => {
          target.postMessage({ id: msg.id, type: 'RAW', value }, '*');
        };

        if (msg.type === 'GET') {
          if (prop === 'context') {
            comlinkRespond(context);
          } else if (prop === 'getCapabilities' || prop === 'getChains') {
            comlinkRespond([]);
          } else {
            comlinkRespond(undefined);
          }
          return;
        }

        if (msg.type === 'APPLY') {
          const rawArgs = (Array.isArray(msg.argumentList) ? msg.argumentList : [])
            .map((a: any) => (a?.type === 'RAW' ? a.value : undefined));

          if (prop === 'ready') {
            comlinkRespond(undefined);
          } else if (prop === 'close') {
            setOpen(false);
            comlinkRespond(undefined);
          } else if (prop === 'openUrl') {
            const urlArg = rawArgs[0];
            const href = typeof urlArg === 'string' ? urlArg : (urlArg?.url ?? '');
            if (href) window.open(href.trim(), '_blank', 'noopener,noreferrer');
            comlinkRespond(undefined);
          } else if (prop === 'getCapabilities' || prop === 'getChains') {
            comlinkRespond([]);
          } else if (prop === 'setPrimaryButton') {
            comlinkRespond(undefined);
          } else if (prop === 'composeCast') {
            const opts = rawArgs[0] ?? {};
            if (opts.text !== undefined) {
              window.dispatchEvent(new CustomEvent('hh:compose', { detail: { text: opts.text ?? '' } }));
            }
            comlinkRespond({ result: {} });
          } else if (prop === 'viewCast') {
            const hash = rawArgs[0]?.hash ?? rawArgs[0];
            if (hash) window.dispatchEvent(new CustomEvent('hh:view-cast', { detail: { hash } }));
            comlinkRespond({ result: undefined });
          } else if (prop === 'viewProfile') {
            const fid = rawArgs[0]?.fid ?? rawArgs[0];
            if (fid) window.dispatchEvent(new CustomEvent('hh:view-profile', { detail: { fid } }));
            comlinkRespond({ result: undefined });
          } else if (prop === 'signIn') {
            comlinkRespond({ error: { type: 'rejected_by_user' } });
          } else if (prop === 'addFrame' || prop === 'addMiniApp') {
            comlinkRespond({ error: { type: 'rejected_by_user' } });
          } else if (prop === 'impactOccurred' || prop === 'notificationOccurred' || prop === 'selectionChanged') {
            comlinkRespond(undefined);
          } else {
            comlinkRespond(undefined);
          }
          return;
        }

        if (msg.type === 'RELEASE') {
          target.postMessage({ id: msg.id, type: 'RAW', value: undefined }, '*');
          return;
        }

        // SET / CONSTRUCT / ENDPOINT — acknowledge but no-op
        target.postMessage({ id: msg.id, type: 'RAW', value: undefined }, '*');
        return;
      }

      // --- Legacy Farcaster context (older frame SDKs) ---
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

      if (isReady) {
        sendContext(target, context, msg);
        return;
      }

      // --- EIP-1193 wallet provider ---
      if (handleWalletRpc(target, msg)) return;

      // --- close ---
      const isClose =
        msg.type === 'frameClose' ||
        msg.type === 'close' ||
        (msg.type === 'fc-frame' && msg.action === 'close') ||
        (msg.type === 'fc-mini-app' && msg.action === 'close');
      if (isClose) { setOpen(false); return; }

      // --- openUrl ---
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
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    const profile = getProfile();
    const ctx = buildContext(profile);
    // Legacy SDK formats
    sendContext(target, ctx);
    // Comlink SDK: push context eagerly so isInMiniApp() resolves without waiting for a GET
    // The SDK checks `miniAppHost.context` which, once it sees the RAW value, caches it.
    // We can't know the comlink id ahead of time, so we rely on responding to GET messages.
    // However, some SDK versions may check a global; inject it as a fallback.
    try {
      target.postMessage({ type: 'farcasterContextResponse', context: ctx }, '*');
    } catch {}
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "var(--bg-dark)",
        display: "flex", flexDirection: "column",
        animation: "hhSlideUp 0.22s ease-out",
        paddingTop: "env(safe-area-inset-top, 0px)",
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

      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <iframe
          ref={iframeRef}
          src={url}
          onLoad={handleIframeLoad}
          style={{ flex: 1, border: "none", width: "100%", background: "#fff" }}
          allow="camera; microphone; clipboard-write; payment"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-top-navigation-by-user-activation"
          title={title || hostname}
        />
      </div>
    </div>
  );
}
