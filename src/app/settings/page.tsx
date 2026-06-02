"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

// ── Theme data ────────────────────────────────────────────────────────────────

const FREE_THEMES = [
  { id: "default",  name: "HomieHouse",        emoji: "🏠", description: "Classic dark mode",           preview: { bg: "#111111", surface: "#1C1C1C", text: "#FFFFFF", accent: "#FFFFFF", muted: "rgba(255,255,255,0.5)" } },
  { id: "michigan", name: "Go Blue",            emoji: "〽️", description: "University of Michigan",     preview: { bg: "#00274C", surface: "#003875", text: "#FFCB05", accent: "#FFCB05", muted: "rgba(255,203,5,0.6)" } },
  { id: "msu",      name: "Go Green",           emoji: "🌿", description: "Michigan State University",   preview: { bg: "#18453B", surface: "#1F5246", text: "#FFFFFF", accent: "#FFFFFF", muted: "rgba(255,255,255,0.6)" } },
  { id: "derby",    name: "Run for the Roses",  emoji: "🌹", description: "Kentucky Derby",              preview: { bg: "#1A0A00", surface: "#2D1600", text: "#F5E6C8", accent: "#C53030", muted: "rgba(197,165,114,0.7)" } },
  { id: "munchers", name: "Number Munchers",    emoji: "👾", description: "Avoid the Troggles",          preview: { bg: "#001100", surface: "#002200", text: "#00FF41", accent: "#00FF41", muted: "rgba(0,255,65,0.5)" } },
  { id: "winamp",   name: "Winamp",             emoji: "🎵", description: "It really whips the llama's ass", preview: { bg: "#1E1E1E", surface: "#2D2D2D", text: "#FFFFFF", accent: "#00FF00", muted: "rgba(255,255,255,0.5)" } },
];

const PREMIUM_THEMES = [
  { id: "synthwave", name: "Synthwave",  emoji: "🌆", description: "Neon nights",     preview: { bg: "#0d0221", surface: "#1a0533", text: "#ff71ce", accent: "#01cdfe", muted: "rgba(255,113,206,0.60)" } },
  { id: "ocean",     name: "Ocean",      emoji: "🌊", description: "Deep blue vibes", preview: { bg: "#0a1628", surface: "#0f2040", text: "#e0f2ff", accent: "#38bdf8", muted: "rgba(224,242,255,0.55)" } },
  { id: "dracula",   name: "Dracula",    emoji: "🧛", description: "Dracula theme",   preview: { bg: "#282a36", surface: "#343746", text: "#f8f8f2", accent: "#bd93f9", muted: "rgba(248,248,242,0.55)" } },
  { id: "sunset",    name: "Sunset",     emoji: "🌅", description: "Golden hour",     preview: { bg: "#1a0a00", surface: "#2d1200", text: "#ffe4cc", accent: "#ff6b35", muted: "rgba(255,228,204,0.55)" } },
];

const ALL_THEMES = [...FREE_THEMES, ...PREMIUM_THEMES];
const PREMIUM_IDS = new Set(PREMIUM_THEMES.map(t => t.id));

// ── Small reusable components ──────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function SettingRow({
  icon, label, sublabel, onClick, right, active,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  right?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px", background: active ? "var(--surface)" : "none",
        border: "none", cursor: onClick ? "pointer" : "default", textAlign: "left",
        transition: "background 0.15s",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "var(--bg-dark)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
      style={{ width: 44, height: 26, borderRadius: 13, flexShrink: 0, background: on ? "var(--accent)" : "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}
    >
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
    </button>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

// ── Theme mini-card ────────────────────────────────────────────────────────────

function ThemeCard({ theme, active, locked, onClick }: { theme: (typeof ALL_THEMES)[0]; active: boolean; locked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "var(--surface)", border: active ? "2px solid var(--accent)" : "2px solid var(--border)",
        borderRadius: 12, padding: 0, cursor: "pointer", textAlign: "left",
        overflow: "hidden", transition: "border-color 0.15s, transform 0.1s",
        transform: active ? "scale(1.02)" : "scale(1)", position: "relative",
        opacity: locked ? 0.75 : 1,
      }}
    >
      {/* Mini preview */}
      <div style={{ background: theme.preview.bg, padding: "12px 12px 8px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: theme.preview.muted }} />
          <div style={{ height: 6, borderRadius: 3, background: theme.preview.muted, width: 50, opacity: 0.7 }} />
        </div>
        <div style={{ background: theme.preview.surface, borderRadius: 6, padding: "6px 8px" }}>
          <div style={{ height: 5, borderRadius: 3, background: theme.preview.text, width: "70%", marginBottom: 4, opacity: 0.9 }} />
          <div style={{ height: 4, borderRadius: 3, background: theme.preview.muted, width: "50%" }} />
        </div>
        {active && (
          <div style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: "50%", background: theme.preview.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={theme.preview.bg} strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
        )}
        {locked && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "inherit" }}>
            <span style={{ fontSize: 18 }}>🔒</span>
          </div>
        )}
      </div>
      {/* Label */}
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 1 }}>
          <span style={{ fontSize: 12 }}>{theme.emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-on-dark)" }}>{theme.name}</span>
        </div>
        <span style={{ fontSize: 10, color: "var(--muted-on-dark)" }}>{theme.description}</span>
      </div>
    </button>
  );
}

// ── iOS install card ───────────────────────────────────────────────────────────

function isIOS() { return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() { return typeof window !== "undefined" && ((window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches); }

function IOSInstallCard() {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-on-dark)", marginBottom: 4 }}>Add HomieHouse to your Home Screen</div>
        <div style={{ fontSize: 13, color: "var(--muted-on-dark)", lineHeight: 1.5 }}>iOS requires apps to be installed as Home Screen icons to receive push notifications.</div>
      </div>
      {[
        { step: "1", icon: <ShareIcon />, text: <><strong style={{ color: "var(--text-on-dark)" }}>Share</strong> → bottom of Safari</> },
        { step: "2", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16m8-8H4" /></svg>, text: <>Tap <strong style={{ color: "var(--text-on-dark)" }}>Add to Home Screen</strong></> },
        { step: "3", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>, text: <>Open HomieHouse from your Home Screen</> },
      ].map(({ step, icon, text }) => (
        <div key={step} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: "var(--accent)", opacity: 0.85, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bg-dark)", fontSize: 11, fontWeight: 700 }}>{step}</div>
          <span style={{ color: "var(--muted-on-dark)", flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: 13, color: "var(--muted-on-dark)" }}>{text}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type ActivePanel = null | "themes" | "notifications" | "wallet";

export default function SettingsPage() {
  const router = useRouter();
  const [activeTheme, setActiveTheme] = useState("default");
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [notifState, setNotifState] = useState<"granted" | "denied" | "default" | "unsupported">("unsupported");
  const [notifLoading, setNotifLoading] = useState(false);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  useEffect(() => {
    setActiveTheme(localStorage.getItem("hh_theme") || "default");
    setPremiumUnlocked(localStorage.getItem("hh_premium_unlocked") === "true");
    setIos(isIOS());
    setStandalone(isStandalone());
    if ("Notification" in window) setNotifState(Notification.permission as any);
  }, []);

  function applyTheme(id: string) {
    setActiveTheme(id);
    localStorage.setItem("hh_theme", id);
    if (id === "default") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", id);
  }

  async function toggleNotifications() {
    if (notifLoading) return;
    setNotifLoading(true);
    try {
      if (notifState === "granted") {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.getRegistration("/sw.js");
          const sub = await reg?.pushManager?.getSubscription();
          if (sub) {
            const stored = localStorage.getItem("hh_profile");
            const fid = stored ? JSON.parse(stored).fid : null;
            if (fid) await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ fid, endpoint: sub.endpoint }) });
            await sub.unsubscribe();
          }
        }
        setNotifState("default");
      } else {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;
        const stored = localStorage.getItem("hh_profile");
        const fid = stored ? JSON.parse(stored).fid : null;
        if (!fid) return;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setNotifState(permission as any); return; }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const padding = "=".repeat((4 - (vapidKey.length % 4)) % 4);
        const base64 = (vapidKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(base64);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: arr.buffer as ArrayBuffer });
        await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fid, subscription: sub.toJSON() }) });
        setNotifState("granted");
      }
    } catch (err) { console.warn("[settings] notif toggle error:", err); }
    finally { setNotifLoading(false); }
  }

  const showInstallPrompt = ios && !standalone;
  const notifEnabled = notifState === "granted";
  const notifDenied = notifState === "denied";
  const currentThemeName = ALL_THEMES.find(t => t.id === activeTheme)?.name ?? "HomieHouse";

  const togglePanel = (panel: ActivePanel) =>
    setActivePanel(prev => (prev === panel ? null : panel));

  return (
    <AppShell>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--muted-on-dark)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Settings</h1>
      </div>

      {/* Two-column on lg+ — left: nav list, right: panel content */}
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

        {/* ── Left column: settings list ── */}
        <div style={{ minWidth: 260, maxWidth: 320, flex: "0 0 280px" }}>

          {/* Appearance */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-on-dark)", padding: "0 4px 8px" }}>Appearance</div>
            <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
              <SettingRow
                active={activePanel === "themes"}
                onClick={() => togglePanel("themes")}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>}
                label="Theme"
                sublabel={currentThemeName}
              />
            </div>
          </div>

          {/* Notifications */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-on-dark)", padding: "0 4px 8px" }}>Notifications</div>
            <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
              {showInstallPrompt ? (
                <SettingRow
                  active={activePanel === "notifications"}
                  onClick={() => togglePanel("notifications")}
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                  label="Push Notifications"
                  sublabel="Requires Home Screen install on iOS"
                />
              ) : (
                <SettingRow
                  onClick={notifDenied ? undefined : toggleNotifications}
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                  label="Push Notifications"
                  sublabel={notifDenied ? "Blocked — enable in browser settings" : notifEnabled ? "On — replies, likes & follows" : "Off — tap to enable"}
                  right={notifDenied ? undefined : <Toggle on={notifEnabled} onToggle={toggleNotifications} />}
                />
              )}
            </div>
            {notifDenied && <p style={{ fontSize: 12, color: "var(--muted-on-dark)", margin: "6px 4px 0" }}>Open browser/OS settings to unblock.</p>}
          </div>

          {/* Wallet */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-on-dark)", padding: "0 4px 8px" }}>Wallet</div>
            <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
              <SettingRow
                onClick={() => router.push("/settings/wallet")}
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 12a1 1 0 100 2 1 1 0 000-2z" /></svg>}
                label="Linked Wallets"
                sublabel="Connect and manage wallets"
              />
            </div>
          </div>
        </div>

        {/* ── Right column: panel content ── */}
        {activePanel === "themes" && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text-on-dark)" }}>Choose Theme</div>

            {/* Free themes */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-on-dark)", marginBottom: 10 }}>Free</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
              {FREE_THEMES.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  active={activeTheme === theme.id}
                  locked={false}
                  onClick={() => applyTheme(theme.id)}
                />
              ))}
            </div>

            {/* Premium themes */}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-on-dark)", marginBottom: 10 }}>
              Premium {premiumUnlocked ? <span style={{ color: "var(--accent)", marginLeft: 6 }}>✓ Unlocked</span> : <span style={{ color: "var(--muted-on-dark)", marginLeft: 6, fontWeight: 400, textTransform: "none" }}>— $0.50 USDC donation</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
              {PREMIUM_THEMES.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  active={activeTheme === theme.id}
                  locked={!premiumUnlocked}
                  onClick={() => {
                    if (!premiumUnlocked) {
                      // Navigate to dedicated themes page for donation flow
                      router.push("/settings/themes");
                      return;
                    }
                    applyTheme(theme.id);
                  }}
                />
              ))}
            </div>

            {!premiumUnlocked && (
              <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--muted-on-dark)", lineHeight: 1.5 }}>
                Unlock all premium themes with a one-time $0.50 USDC donation on Base.{" "}
                <button onClick={() => router.push("/settings/themes")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, fontSize: 13 }}>
                  Unlock →
                </button>
              </div>
            )}
          </div>
        )}

        {activePanel === "notifications" && showInstallPrompt && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text-on-dark)" }}>Push Notifications</div>
            <IOSInstallCard />
          </div>
        )}

        {/* Default: show hint text when nothing selected */}
        {!activePanel && (
          <div className="hidden lg:flex" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: "4rem 2rem", color: "var(--muted-on-dark)", fontSize: 14, textAlign: "center" }}>
            Select a setting to configure it
          </div>
        )}
      </div>
    </AppShell>
  );
}
