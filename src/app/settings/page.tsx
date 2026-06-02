"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function SettingRow({
  icon,
  label,
  sublabel,
  onClick,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px", background: "none", border: "none", cursor: onClick ? "pointer" : "default",
        textAlign: "left",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: "var(--bg-dark)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-on-dark)" }}>{label}</div>
        {sublabel && <div style={{ fontSize: 12, color: "var(--muted-on-dark)", marginTop: 1 }}>{sublabel}</div>}
      </div>
      <div style={{ color: "var(--muted-on-dark)", flexShrink: 0 }}>{right ?? (onClick ? <ChevronRight /> : null)}</div>
    </button>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: 44, height: 26, borderRadius: 13, flexShrink: 0,
        background: on ? "var(--accent)" : "rgba(255,255,255,0.15)",
        border: "none", cursor: "pointer", position: "relative",
        transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: on ? 21 : 3,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </button>
  );
}

// Share icon (iOS install step 1)
function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

type NotifState = "granted" | "denied" | "default" | "unsupported";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
}

// Instruction card for iOS users in browser
function IOSInstallCard() {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 14, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-on-dark)", marginBottom: 4 }}>
          Add HomieHouse to your Home Screen
        </div>
        <div style={{ fontSize: 13, color: "var(--muted-on-dark)", lineHeight: 1.5 }}>
          iOS requires apps to be installed as Home Screen icons to receive push notifications.
        </div>
      </div>
      {[
        {
          step: "1",
          icon: <ShareIcon />,
          text: <>Tap the <strong style={{ color: "var(--text-on-dark)" }}>Share</strong> button at the bottom of Safari</>,
        },
        {
          step: "2",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v16m8-8H4" />
            </svg>
          ),
          text: <>Scroll down and tap <strong style={{ color: "var(--text-on-dark)" }}>Add to Home Screen</strong></>,
        },
        {
          step: "3",
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ),
          text: <>Open HomieHouse from your Home Screen — notifications will be available in Settings</>,
        },
      ].map(({ step, icon, text }) => (
        <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: "var(--accent)", opacity: 0.85,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--bg-dark)", fontSize: 12, fontWeight: 700,
          }}>
            {step}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <span style={{ color: "var(--muted-on-dark)", flexShrink: 0 }}>{icon}</span>
            <span style={{ fontSize: 13, color: "var(--muted-on-dark)", lineHeight: 1.5 }}>{text}</span>
          </div>
        </div>
      ))}
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-on-dark)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
        </svg>
        <span style={{ fontSize: 11, color: "var(--muted-on-dark)" }}>Requires iOS 16.4 or later</span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTheme, setActiveTheme] = useState("default");
  const [notifState, setNotifState] = useState<NotifState>("unsupported");
  const [notifLoading, setNotifLoading] = useState(false);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("hh_theme") || "default";
    setActiveTheme(saved);
    setIos(isIOS());
    setStandalone(isStandalone());
    if ("Notification" in window) {
      setNotifState(Notification.permission as NotifState);
    }
  }, []);

  async function toggleNotifications() {
    if (notifLoading) return;
    setNotifLoading(true);
    try {
      if (notifState === "granted") {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.getRegistration("/sw.js");
          const sub = await reg?.pushManager?.getSubscription();
          if (sub) {
            const fid = getFid();
            if (fid) {
              await fetch("/api/push/subscribe", {
                method: "DELETE",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ fid, endpoint: sub.endpoint }),
              });
            }
            await sub.unsubscribe();
          }
        }
        setNotifState("default");
      } else {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;
        const fid = getFid();
        if (!fid) return;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setNotifState(permission as NotifState); return; }

        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const padding = "=".repeat((4 - (vapidKey.length % 4)) % 4);
        const base64 = (vapidKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(base64);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: arr.buffer as ArrayBuffer,
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fid, subscription: sub.toJSON() }),
        });
        setNotifState("granted");
      }
    } catch (err) {
      console.warn("[settings] notif toggle error:", err);
    } finally {
      setNotifLoading(false);
    }
  }

  function getFid(): number | null {
    try {
      const stored = localStorage.getItem("hh_profile");
      if (!stored) return null;
      return JSON.parse(stored).fid || null;
    } catch { return null; }
  }

  const themeName = ({
    default: "HomieHouse", michigan: "Go Blue", msu: "Go Green",
    derby: "Run for the Roses", munchers: "Number Munchers", winamp: "Winamp",
  } as Record<string, string>)[activeTheme] ?? "HomieHouse";

  const notifEnabled = notifState === "granted";
  const notifDenied = notifState === "denied";
  // iOS in browser (not installed) — show install instructions instead of toggle
  const showInstallPrompt = ios && !standalone;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", color: "var(--text-on-dark)", paddingBottom: 100 }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "var(--bg-dark)", zIndex: 10 }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", color: "var(--muted-on-dark)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Settings</h1>
      </header>

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>

        {/* Appearance */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-on-dark)", padding: "0 4px 8px" }}>
            Appearance
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            <SettingRow
              onClick={() => router.push("/settings/themes")}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              }
              label="Theme"
              sublabel={themeName}
            />
          </div>
        </div>

        {/* Notifications */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-on-dark)", padding: "0 4px 8px" }}>
            Notifications
          </div>

          {showInstallPrompt ? (
            <IOSInstallCard />
          ) : (
            <>
              <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                <SettingRow
                  onClick={notifDenied ? undefined : toggleNotifications}
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  }
                  label="Push Notifications"
                  sublabel={
                    notifDenied
                      ? "Blocked — enable in browser/OS settings"
                      : notifEnabled
                      ? "On — replies, likes & follows"
                      : "Off — tap to enable"
                  }
                  right={notifDenied ? undefined : <Toggle on={notifEnabled} onToggle={toggleNotifications} />}
                />
              </div>
              {notifDenied && (
                <p style={{ fontSize: 12, color: "var(--muted-on-dark)", margin: "8px 4px 0" }}>
                  Notifications are blocked. Open your browser or OS settings and allow notifications for this site.
                </p>
              )}
            </>
          )}
        </div>

        {/* Wallet */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-on-dark)", padding: "0 4px 8px" }}>
            Wallet
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            <SettingRow
              onClick={() => router.push("/settings/wallet")}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a1 1 0 100 2 1 1 0 000-2z" />
                </svg>
              }
              label="Linked Wallets"
              sublabel="Connect and manage wallets"
            />
          </div>
        </div>

      </main>
    </div>
  );
}
