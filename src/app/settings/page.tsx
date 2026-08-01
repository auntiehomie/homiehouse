"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import Image from "next/image";
import AppShell from "@/components/AppShell";
import { provisionSignerWithMnemonic } from "@/lib/fc-key-add";
import { getEli5Mode, setEli5Mode } from "@/lib/eli5";
import { BeginnerModeBadge } from "@/lib/progressive-disclosure";

// ── Theme data ────────────────────────────────────────────────────────────────

const FREE_THEMES = [
  { id: "default",  name: "HomieHouse",        emoji: "🏠", description: "Classic dark mode",                preview: { bg: "#111111", surface: "#1C1C1C", text: "#FFFFFF", accent: "#FFFFFF", muted: "rgba(255,255,255,0.5)" } },
  { id: "michigan", name: "Go Blue",            emoji: "〽️", description: "University of Michigan",         preview: { bg: "#00274C", surface: "#003875", text: "#FFCB05", accent: "#FFCB05", muted: "rgba(255,203,5,0.6)" } },
  { id: "msu",      name: "Go Green",           emoji: "🌿", description: "Michigan State University",       preview: { bg: "#18453B", surface: "#1F5246", text: "#FFFFFF", accent: "#FFFFFF", muted: "rgba(255,255,255,0.6)" } },
  { id: "derby",    name: "Run for the Roses",  emoji: "🌹", description: "Kentucky Derby",                  preview: { bg: "#1A0A00", surface: "#2D1600", text: "#F5E6C8", accent: "#C53030", muted: "rgba(197,165,114,0.7)" } },
  { id: "munchers", name: "Number Munchers",    emoji: "👾", description: "Avoid the Troggles",              preview: { bg: "#001100", surface: "#002200", text: "#00FF41", accent: "#00FF41", muted: "rgba(0,255,65,0.5)" } },
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

// ── Icon helpers ───────────────────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

// ── Compact SettingRow ────────────────────────────────────────────────────────

function SettingRow({
  icon, label, sublabel, onClick, right, active, danger,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  right?: React.ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 11,
        padding: "10px 14px", background: active ? "rgba(255,255,255,0.06)" : "none",
        border: "none", cursor: onClick ? "pointer" : "default", textAlign: "left",
        transition: "background 0.15s",
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: danger ? "rgba(239,68,68,0.15)" : "var(--bg-dark)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: danger ? "#ef4444" : "var(--text-on-dark)", lineHeight: 1.2 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, color: "var(--muted-on-dark)", marginTop: 1 }}>{sublabel}</div>}
      </div>
      <div style={{ color: "var(--muted-on-dark)", flexShrink: 0 }}>{right ?? (onClick ? <ChevronRight /> : null)}</div>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-on-dark)", padding: "0 4px 6px" }}>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "0 14px" }} />;
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{ width: 40, height: 24, borderRadius: 12, flexShrink: 0, background: on ? "var(--accent)" : "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
    </button>
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
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-on-dark)", marginBottom: 3 }}>Add to Home Screen</div>
        <div style={{ fontSize: 12, color: "var(--muted-on-dark)", lineHeight: 1.5 }}>iOS requires a Home Screen install to receive push notifications.</div>
      </div>
      {[
        { step: "1", icon: <ShareIcon />, text: <><strong style={{ color: "var(--text-on-dark)" }}>Share</strong> → bottom of Safari</> },
        { step: "2", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16m8-8H4" /></svg>, text: <>Tap <strong style={{ color: "var(--text-on-dark)" }}>Add to Home Screen</strong></> },
        { step: "3", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>, text: <>Open HomieHouse from your Home Screen</> },
      ].map(({ step, icon, text }) => (
        <div key={step} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: "var(--accent)", opacity: 0.85, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bg-dark)", fontSize: 10, fontWeight: 700 }}>{step}</div>
          <span style={{ color: "var(--muted-on-dark)", flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: 12, color: "var(--muted-on-dark)" }}>{text}</span>
        </div>
      ))}
    </div>
  );
}

// ── FID Import Panel ───────────────────────────────────────────────────────────

interface FarcasterProfile {
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

function AccountPanel({ profile, onProfileUpdate, hideTitle }: { profile: FarcasterProfile | null; onProfileUpdate: (p: FarcasterProfile) => void; hideTitle?: boolean }) {
  const [fidInput, setFidInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function importByFid() {
    const fid = parseInt(fidInput.trim(), 10);
    if (!fid || isNaN(fid) || fid <= 0) { setError("Enter a valid FID number"); return; }
    setLoading(true); setError(""); setSuccess(false);
    try {
      const res = await fetch(`/api/profile?fid=${fid}`);
      if (!res.ok) throw new Error("FID not found");
      const data = await res.json();
      const updated: FarcasterProfile = {
        fid,
        username: data.username,
        displayName: data.display_name || data.username,
        pfpUrl: data.pfp_url,
      };
      localStorage.setItem("hh_profile", JSON.stringify(updated));
      onProfileUpdate(updated);
      setSuccess(true);
      setFidInput("");
    } catch {
      setError("Could not find that FID. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!hideTitle && <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-on-dark)" }}>Farcaster Account</div>}

      {/* Current profile card */}
      {profile?.fid ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          {profile.pfpUrl ? (
            <Image src={profile.pfpUrl} alt="" width={44} height={44} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              {(profile.displayName || profile.username || "?")[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-on-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile.displayName || profile.username || `FID ${profile.fid}`}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-on-dark)" }}>
              {profile.username ? `@${profile.username} · ` : ""}FID {profile.fid}
            </div>
          </div>
          <div style={{ fontSize: 11, padding: "3px 8px", background: "rgba(232,119,34,0.15)", color: "var(--accent)", borderRadius: 6, fontWeight: 600 }}>Connected</div>
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 16, fontSize: 13, color: "var(--muted-on-dark)" }}>
          No Farcaster account linked yet.
        </div>
      )}

      {/* Import by FID */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-on-dark)", marginBottom: 4 }}>
          {profile?.fid ? "Switch to a different FID" : "Import by FID"}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-on-dark)", marginBottom: 12, lineHeight: 1.5 }}>
          Enter a Farcaster ID to browse read-only. Your feed, profile, and notifications will use this identity.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            placeholder="e.g. 12345"
            value={fidInput}
            onChange={e => { setFidInput(e.target.value); setError(""); setSuccess(false); }}
            onKeyDown={e => e.key === "Enter" && importByFid()}
            style={{
              flex: 1, padding: "9px 12px", borderRadius: 8, fontSize: 14,
              background: "var(--bg-dark)", border: "1px solid var(--border)",
              color: "var(--text-on-dark)", outline: "none",
            }}
          />
          <button
            onClick={importByFid}
            disabled={loading || !fidInput.trim()}
            style={{
              padding: "9px 16px", borderRadius: 8, background: "var(--accent)", color: "#fff",
              border: "none", fontWeight: 600, fontSize: 13, cursor: loading ? "wait" : "pointer",
              opacity: loading || !fidInput.trim() ? 0.6 : 1, whiteSpace: "nowrap",
            }}
          >
            {loading ? "..." : "Import"}
          </button>
        </div>
        {error && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{error}</div>}
        {success && <div style={{ fontSize: 12, color: "#22c55e", marginTop: 8 }}>Profile imported successfully.</div>}
        <div style={{ fontSize: 11, color: "var(--muted-on-dark)", marginTop: 10, lineHeight: 1.5 }}>
          Your FID is the number in your Farcaster profile URL, or visible in any Farcaster client under account settings.
        </div>
      </div>

      {/* Mnemonic import — full write access */}
      <MnemonicImportSection existingFid={profile?.fid} onSuccess={onProfileUpdate} />
    </div>
  );
}

// ── Mnemonic / recovery-phrase signer import ───────────────────────────────────

type MnemonicStep = "idle" | "confirm" | "working" | "done" | "error";

function MnemonicImportSection({ existingFid, onSuccess }: { existingFid?: number; onSuccess: (p: FarcasterProfile) => void }) {
  const [open, setOpen] = useState(false);
  const [fidInput, setFidInput] = useState(existingFid ? String(existingFid) : "");
  const [phrase, setPhrase] = useState("");
  const [step, setStep] = useState<MnemonicStep>("idle");
  const [statusMsg, setStatusMsg] = useState("");

  async function handleImport() {
    const fid = parseInt(fidInput.trim(), 10);
    if (!fid || isNaN(fid) || fid <= 0) { setStatusMsg("Enter a valid FID."); setStep("error"); return; }
    if (phrase.trim().split(/\s+/).length < 12) { setStatusMsg("Enter your full 12 or 24-word recovery phrase."); setStep("error"); return; }

    setStep("working"); setStatusMsg("Generating signer key…");
    try {
      const result = await provisionSignerWithMnemonic(fid, phrase.trim());

      setStatusMsg("Registering on Farcaster network…");
      // Store the approved signer — shape that useFarcasterWrites expects
      localStorage.setItem(`signer_${fid}`, JSON.stringify({ status: "approved", private_key: result.privateKeyHex }));
      window.dispatchEvent(new CustomEvent("hh:signer:approved"));

      // Fetch and store profile
      const res = await fetch(`/api/profile?fid=${fid}`);
      if (res.ok) {
        const data = await res.json();
        const updated: FarcasterProfile = { fid, username: data.username, displayName: data.display_name || data.username, pfpUrl: data.pfp_url };
        localStorage.setItem("hh_profile", JSON.stringify(updated));
        onSuccess(updated);
      }

      setPhrase(""); // clear phrase from memory
      setStep("done");
      setStatusMsg("Account imported. You can now cast, like, and reply as this account.");
    } catch (err: any) {
      setPhrase("");
      setStep("error");
      setStatusMsg(err?.message || "Import failed. Check your FID and recovery phrase.");
    }
  }

  return (
    <div style={{ marginTop: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-on-dark)" }}>Import with Recovery Phrase</div>
          <div style={{ fontSize: 11, color: "var(--muted-on-dark)", marginTop: 2 }}>Optional — enables posting, liking & recasting</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-on-dark)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
          {step !== "done" && (
            <>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "10px 12px", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 8, margin: "12px 0" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                <div style={{ fontSize: 11, color: "#eab308", lineHeight: 1.5 }}>
                  Only use this on a private, trusted device. Your phrase is never stored or sent to any server — it is held in memory only while generating your signer key.
                </div>
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-on-dark)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Your FID</div>
              <input
                type="number"
                placeholder="e.g. 3103"
                value={fidInput}
                onChange={e => setFidInput(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 14, background: "var(--bg-dark)", border: "1px solid var(--border)", color: "var(--text-on-dark)", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
              />

              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-on-dark)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Recovery Phrase</div>
              <textarea
                placeholder="word1 word2 word3 … (12 or 24 words)"
                value={phrase}
                onChange={e => setPhrase(e.target.value)}
                rows={3}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13, fontFamily: "monospace", background: "var(--bg-dark)", border: "1px solid var(--border)", color: "var(--text-on-dark)", outline: "none", resize: "none", boxSizing: "border-box", marginBottom: 12 }}
              />

              {step === "idle" && (
                <button
                  onClick={() => setStep("confirm")}
                  disabled={!fidInput.trim() || phrase.trim().split(/\s+/).length < 12}
                  style={{ width: "100%", padding: "10px", borderRadius: 8, background: "var(--accent)", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: !fidInput.trim() || phrase.trim().split(/\s+/).length < 12 ? 0.5 : 1 }}
                >
                  Continue
                </button>
              )}

              {step === "confirm" && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted-on-dark)", marginBottom: 10, lineHeight: 1.5 }}>
                    This will register a new signer key for FID <strong style={{ color: "var(--text-on-dark)" }}>{fidInput}</strong> on the Farcaster network. The server wallet will pay the gas fee. Ready to proceed?
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setStep("idle")} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "var(--bg-dark)", border: "1px solid var(--border)", color: "var(--text-on-dark)", fontSize: 13, cursor: "pointer" }}>Back</button>
                    <button onClick={handleImport} style={{ flex: 2, padding: "9px", borderRadius: 8, background: "var(--accent)", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Import Account</button>
                  </div>
                </div>
              )}

              {step === "working" && (
                <div style={{ fontSize: 12, color: "var(--muted-on-dark)", textAlign: "center", padding: "8px 0" }}>{statusMsg}</div>
              )}

              {step === "error" && (
                <div>
                  <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 10 }}>{statusMsg}</div>
                  <button onClick={() => setStep("idle")} style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Try again</button>
                </div>
              )}
            </>
          )}

          {step === "done" && (
            <div style={{ padding: "12px 0 4px", textAlign: "center" }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 600, marginBottom: 4 }}>Account imported</div>
              <div style={{ fontSize: 12, color: "var(--muted-on-dark)" }}>{statusMsg}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type ActivePanel = null | "account" | "themes" | "notifications" | "wallet";

export default function SettingsPage() {
  const router = useRouter();
  const { logout, authenticated } = usePrivy();

  const [activeTheme, setActiveTheme] = useState("default");
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [notifState, setNotifState] = useState<"granted" | "denied" | "default" | "unsupported">("unsupported");
  const [notifLoading, setNotifLoading] = useState(false);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [profile, setProfile] = useState<FarcasterProfile | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [eli5, setEli5] = useState(false);

  useEffect(() => {
    setActiveTheme(localStorage.getItem("hh_theme") || "default");
    setPremiumUnlocked(localStorage.getItem("hh_premium_unlocked") === "true");
    setIos(isIOS());
    setStandalone(isStandalone());
    if ("Notification" in window) setNotifState(Notification.permission as any);
    setEli5(getEli5Mode());
    try {
      const raw = localStorage.getItem("hh_profile");
      if (raw) setProfile(JSON.parse(raw));
    } catch {}
  }, []);

  function toggleEli5() {
    const next = !eli5;
    setEli5(next);
    setEli5Mode(next);
  }

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
            const fid = profile?.fid;
            if (fid) await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ fid, endpoint: sub.endpoint }) });
            await sub.unsubscribe();
          }
        }
        setNotifState("default");
      } else {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;
        const fid = profile?.fid;
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

  function resetLearningProgress() {
    ["hh_learning_plan", "hh_learning_progress", "hh_notes"].forEach(k => localStorage.removeItem(k));
    setResetConfirm(false);
    alert("Learning progress cleared.");
  }

  function exportNotes() {
    try {
      const notes = JSON.parse(localStorage.getItem("hh_notes") || "[]");
      const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "homiehouse-notes.json"; a.click();
      URL.revokeObjectURL(url);
    } catch { alert("No notes to export."); }
  }

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const showInstallPrompt = ios && !standalone;
  const notifEnabled = notifState === "granted";
  const notifDenied = notifState === "denied";
  const currentThemeName = ALL_THEMES.find(t => t.id === activeTheme)?.name ?? "HomieHouse";
  const togglePanel = (panel: ActivePanel) => setActivePanel(prev => prev === panel ? null : panel);

  // On mobile, when a panel is open, render only the panel with a back button
  const mobileShowingPanel = isMobile && activePanel !== null;

  const panelBackButton = (
    <button
      onClick={() => setActivePanel(null)}
      style={{ background: "none", border: "none", color: "var(--muted-on-dark)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
    >
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
    </button>
  );

  const panelTitles: Record<NonNullable<ActivePanel>, string> = {
    account: "Farcaster Account",
    themes: "Choose Theme",
    notifications: "Push Notifications",
    wallet: "Wallet",
  };

  return (
    <AppShell>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        {mobileShowingPanel ? panelBackButton : (
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--muted-on-dark)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
          {mobileShowingPanel ? panelTitles[activePanel!] : "Settings"}
        </h1>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* ── Left column — hidden on mobile when a panel is open ── */}
        <div style={{ minWidth: 240, maxWidth: 300, flex: "0 0 260px", display: mobileShowingPanel ? "none" : undefined }}>

          {/* Account */}
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Account</SectionLabel>
            <Card>
              {/* Profile summary row */}
              <button
                onClick={() => togglePanel("account")}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 11,
                  padding: "10px 14px", background: activePanel === "account" ? "rgba(255,255,255,0.06)" : "none",
                  border: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                {profile?.pfpUrl ? (
                  <Image src={profile.pfpUrl} alt="" width={32} height={32} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {profile?.displayName?.[0]?.toUpperCase() || profile?.username?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-on-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {profile?.displayName || profile?.username || "Not connected"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-on-dark)" }}>
                    {profile?.fid ? `FID ${profile.fid}` : "Import a Farcaster ID"}
                  </div>
                </div>
                <ChevronRight />
              </button>
            </Card>
          </div>

          {/* Appearance */}
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Appearance</SectionLabel>
            <Card>
              <SettingRow
                active={activePanel === "themes"}
                onClick={() => togglePanel("themes")}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>}
                label="Theme"
                sublabel={currentThemeName}
              />
            </Card>
          </div>

          {/* Learning */}
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Learning</SectionLabel>
            <Card>
              <SettingRow
                onClick={toggleEli5}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                label="Simple Language Mode"
                sublabel={eli5 ? "On — plain-language explanations, no jargon" : "Off"}
                right={<Toggle on={eli5} onToggle={toggleEli5} />}
              />
              <Divider />
              <div style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-on-dark)", marginBottom: 8 }}>Experience Level</div>
                <BeginnerModeBadge />
              </div>
            </Card>
            <p style={{ fontSize: 11, color: "var(--muted-on-dark)", margin: "5px 4px 0" }}>
              Applies to Ask Homie and new lessons — explains everything assuming zero crypto background.
            </p>
          </div>

          {/* Notifications */}
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Notifications</SectionLabel>
            <Card>
              {showInstallPrompt ? (
                <SettingRow
                  active={activePanel === "notifications"}
                  onClick={() => togglePanel("notifications")}
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                  label="Push Notifications"
                  sublabel="Requires Home Screen install"
                />
              ) : (
                <SettingRow
                  onClick={notifDenied ? undefined : toggleNotifications}
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>}
                  label="Push Notifications"
                  sublabel={notifDenied ? "Blocked in browser settings" : notifEnabled ? "On" : "Off"}
                  right={notifDenied ? undefined : <Toggle on={notifEnabled} onToggle={toggleNotifications} />}
                />
              )}
            </Card>
            {notifDenied && <p style={{ fontSize: 11, color: "var(--muted-on-dark)", margin: "5px 4px 0" }}>Open browser/OS settings to unblock.</p>}
          </div>

          {/* Wallet */}
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Wallet</SectionLabel>
            <Card>
              <SettingRow
                onClick={() => router.push("/settings/wallet")}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 12a1 1 0 100 2 1 1 0 000-2z" /></svg>}
                label="Linked Wallets"
                sublabel="Connect and manage wallets"
              />
            </Card>
          </div>

          {/* Learning */}
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Learning</SectionLabel>
            <Card>
              <SettingRow
                onClick={exportNotes}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                label="Export Notes"
                sublabel="Download your saved notes as JSON"
              />
              <Divider />
              {!resetConfirm ? (
                <SettingRow
                  onClick={() => setResetConfirm(true)}
                  danger
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                  label="Reset Learning Progress"
                  sublabel="Clear your plan and notes"
                />
              ) : (
                <div style={{ padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--muted-on-dark)", flex: 1 }}>Are you sure? This can't be undone.</span>
                  <button onClick={resetLearningProgress} style={{ padding: "5px 10px", borderRadius: 6, background: "#ef4444", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reset</button>
                  <button onClick={() => setResetConfirm(false)} style={{ padding: "5px 10px", borderRadius: 6, background: "var(--bg-dark)", color: "var(--text-on-dark)", border: "1px solid var(--border)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                </div>
              )}
            </Card>
          </div>

          {/* Support */}
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Support</SectionLabel>
            <div style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-on-dark)", marginBottom: 3 }}>Enjoying HomieHouse?</div>
                <div style={{ fontSize: 12, color: "var(--muted-on-dark)", lineHeight: 1.5 }}>
                  HomieHouse is free and independent. If it's been useful, a small tip goes a long way toward keeping the lights on.
                </div>
              </div>
              <SettingRow
                onClick={() => router.push("/settings/themes")}
                icon={<span style={{ fontSize: 15 }}>☕</span>}
                label="Buy us a coffee"
                sublabel="$0.50 USDC on Base · also unlocks premium themes"
              />
            </div>
          </div>

          {/* About */}
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>About</SectionLabel>
            <Card>
              <SettingRow
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-on-dark)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                label="Version"
                sublabel="0.1.0"
                right={<span />}
              />
              <Divider />
              <SettingRow
                onClick={() => window.open("https://github.com/auntiehomie/homiehouse/issues", "_blank")}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-on-dark)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                label="Report an Issue"
                sublabel="GitHub Issues"
              />
            </Card>
          </div>

          {/* Sign Out */}
          {authenticated && (
            <div style={{ marginBottom: 18 }}>
              <Card>
                <SettingRow
                  onClick={logout}
                  danger
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
                  label="Sign Out"
                />
              </Card>
            </div>
          )}
        </div>

        {/* ── Right panel — full width on mobile, flex col on desktop ── */}
        {activePanel === "account" && (
          <div style={{ flex: 1, minWidth: 0, width: mobileShowingPanel ? "100%" : undefined }}>
            <AccountPanel profile={profile} onProfileUpdate={setProfile} hideTitle={isMobile} />
          </div>
        )}

        {activePanel === "themes" && (
          <div style={{ flex: 1, minWidth: 0, width: mobileShowingPanel ? "100%" : undefined }}>
            {!isMobile && <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-on-dark)" }}>Choose Theme</div>}
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-on-dark)", marginBottom: 10 }}>Free</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 20 }}>
              {FREE_THEMES.map(theme => (
                <ThemeCard key={theme.id} theme={theme} active={activeTheme === theme.id} locked={false} onClick={() => applyTheme(theme.id)} />
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-on-dark)", marginBottom: 10 }}>
              Premium {premiumUnlocked ? <span style={{ color: "var(--accent)", marginLeft: 6 }}>✓ Unlocked</span> : <span style={{ color: "var(--muted-on-dark)", marginLeft: 6, fontWeight: 400, textTransform: "none" }}>— $0.50 USDC</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
              {PREMIUM_THEMES.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  active={activeTheme === theme.id}
                  locked={!premiumUnlocked}
                  onClick={() => {
                    if (!premiumUnlocked) { router.push("/settings/themes"); return; }
                    applyTheme(theme.id);
                  }}
                />
              ))}
            </div>
            {!premiumUnlocked && (
              <div style={{ marginTop: 14, padding: "11px 13px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--muted-on-dark)", lineHeight: 1.5 }}>
                Unlock all premium themes with a one-time $0.50 USDC donation on Base.{" "}
                <button onClick={() => router.push("/settings/themes")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, fontSize: 12 }}>
                  Unlock →
                </button>
              </div>
            )}
          </div>
        )}

        {activePanel === "notifications" && showInstallPrompt && (
          <div style={{ flex: 1, minWidth: 0, width: mobileShowingPanel ? "100%" : undefined }}>
            {!isMobile && <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-on-dark)" }}>Push Notifications</div>}
            <IOSInstallCard />
          </div>
        )}

        {!activePanel && (
          <div className="hidden lg:flex" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: "4rem 2rem", color: "var(--muted-on-dark)", fontSize: 13, textAlign: "center" }}>
            Select a setting to configure
          </div>
        )}
      </div>
    </AppShell>
  );
}
