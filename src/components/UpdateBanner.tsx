"use client";

import { useEffect, useState } from "react";

export default function UpdateBanner() {
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleFound = (reg: ServiceWorkerRegistration) => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        // Only show banner when there's already a controlling SW (i.e. this is an update, not first install)
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingSW(sw);
        }
      });
    };

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingSW(reg.waiting);
      }
      reg.addEventListener("updatefound", () => handleFound(reg));
    });

    // Re-check for updates when user comes back to the tab
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        navigator.serviceWorker.getRegistration("/sw.js").then((reg) => reg?.update());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const applyUpdate = () => {
    if (!waitingSW) return;
    const sw = waitingSW;
    // Hide banner immediately so one tap is enough
    setWaitingSW(null);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
    sw.postMessage({ type: "SKIP_WAITING" });
    // Fallback: reload after 2s if controllerchange never fires
    setTimeout(() => window.location.reload(), 2000);
  };

  if (!waitingSW) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 88,   // above bottom nav
        left: 12,
        right: 12,
        zIndex: 8500,
        borderRadius: 14,
        background: "var(--accent)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        animation: "hhBannerUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      <style>{`
        @keyframes hhBannerUp {
          from { transform: translateY(120%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--bg-dark)" }}>
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>

      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--bg-dark)" }}>
        New version available
      </span>

      <button
        onClick={() => setWaitingSW(null)}
        style={{
          background: "rgba(0,0,0,0.15)", border: "none",
          borderRadius: 6, padding: "4px 8px",
          fontSize: 12, color: "var(--bg-dark)", cursor: "pointer",
        }}
      >
        Later
      </button>

      <button
        onClick={applyUpdate}
        style={{
          background: "var(--bg-dark)", border: "none",
          borderRadius: 8, padding: "7px 14px",
          fontSize: 13, fontWeight: 700,
          color: "var(--accent)", cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Update
      </button>
    </div>
  );
}
