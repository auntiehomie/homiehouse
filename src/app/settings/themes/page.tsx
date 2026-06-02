"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { applyCustomThemeVars, clearCustomThemeVars } from "../../../components/ThemeSync";

// Set NEXT_PUBLIC_DONATION_ADDRESS in Vercel env vars to your Base USDC receiving address
const DONATION_ADDRESS = process.env.NEXT_PUBLIC_DONATION_ADDRESS || '';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const DONATE_AMOUNT_USDC = 500000n; // $0.50 — 6 decimals

const FREE_THEMES = [
  {
    id: "default",
    name: "HomieHouse",
    description: "Classic dark mode",
    emoji: "🏠",
    preview: { bg: "#111111", surface: "#1C1C1C", text: "#FFFFFF", accent: "#FFFFFF", muted: "rgba(255,255,255,0.5)" },
  },
  {
    id: "michigan",
    name: "Go Blue",
    description: "University of Michigan",
    emoji: "〽️",
    preview: { bg: "#00274C", surface: "#003875", text: "#FFCB05", accent: "#FFCB05", muted: "rgba(255,203,5,0.6)" },
  },
  {
    id: "msu",
    name: "Go Green",
    description: "Michigan State University",
    emoji: "🌿",
    preview: { bg: "#18453B", surface: "#1F5246", text: "#FFFFFF", accent: "#FFFFFF", muted: "rgba(255,255,255,0.6)" },
  },
  {
    id: "derby",
    name: "Run for the Roses",
    description: "Kentucky Derby",
    emoji: "🌹",
    preview: { bg: "#1A0A00", surface: "#2D1600", text: "#F5E6C8", accent: "#C53030", muted: "rgba(197,165,114,0.7)" },
  },
  {
    id: "munchers",
    name: "Number Munchers",
    description: "Avoid the Troggles",
    emoji: "👾",
    preview: { bg: "#001100", surface: "#002200", text: "#00FF41", accent: "#00FF41", muted: "rgba(0,255,65,0.5)" },
  },
  {
    id: "winamp",
    name: "Winamp",
    description: "It really whips the llama's ass",
    emoji: "🎵",
    preview: { bg: "#000000", surface: "#1a1a1a", text: "#E8E8E8", accent: "#FF8C00", muted: "rgba(232,232,232,0.5)" },
  },
];

const PREMIUM_THEMES = [
  {
    id: "synthwave",
    name: "Synthwave",
    description: "Retro 80s neon",
    emoji: "🌆",
    preview: { bg: "#0d0221", surface: "#1a0533", text: "#ff71ce", accent: "#01cdfe", muted: "rgba(255,113,206,0.6)" },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Deep blue depths",
    emoji: "🌊",
    preview: { bg: "#0a1628", surface: "#0f2040", text: "#e0f2ff", accent: "#38bdf8", muted: "rgba(224,242,255,0.6)" },
  },
  {
    id: "dracula",
    name: "Dracula",
    description: "Classic editor dark",
    emoji: "🧛",
    preview: { bg: "#282a36", surface: "#343746", text: "#f8f8f2", accent: "#bd93f9", muted: "rgba(248,248,242,0.6)" },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm amber glow",
    emoji: "🌅",
    preview: { bg: "#1a0a00", surface: "#2d1200", text: "#ffe4cc", accent: "#ff6b35", muted: "rgba(255,200,140,0.6)" },
  },
];

interface CustomColors {
  bgDark: string;
  surface: string;
  textOnDark: string;
  accent: string;
  navBg: string;
  btnPrimaryBg: string;
  btnPrimaryColor: string;
}

const DEFAULT_CUSTOM: CustomColors = {
  bgDark: '#111111',
  surface: '#1C1C1C',
  textOnDark: '#FFFFFF',
  accent: '#FFFFFF',
  navBg: '#000000',
  btnPrimaryBg: '#334155',
  btnPrimaryColor: '#e2e8f0',
};

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function colorsToVars(c: CustomColors): Record<string, string> {
  return {
    bgDark: c.bgDark,
    surface: c.surface,
    textOnDark: c.textOnDark,
    mutedOnDark: hexToRgba(c.textOnDark, 0.58),
    border: hexToRgba(c.accent, 0.18),
    accent: c.accent,
    navBg: c.navBg,
    btnPrimaryBg: c.btnPrimaryBg,
    btnPrimaryColor: c.btnPrimaryColor,
  };
}

// ── ThemeCard ─────────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  active,
  locked,
  onClick,
}: {
  theme: typeof FREE_THEMES[0];
  active: boolean;
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: active ? "2px solid var(--accent)" : "2px solid var(--border)",
        borderRadius: 14,
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        overflow: "hidden",
        transition: "border-color 0.15s, transform 0.1s",
        transform: active ? "scale(1.02)" : "scale(1)",
        position: "relative",
        opacity: locked ? 0.75 : 1,
      }}
    >
      {/* Preview */}
      <div style={{ background: theme.preview.bg, padding: "14px 14px 10px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: theme.preview.muted }} />
          <div style={{ height: 8, borderRadius: 4, background: theme.preview.muted, width: 60, opacity: 0.7 }} />
        </div>
        <div style={{ background: theme.preview.surface, borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ height: 7, borderRadius: 4, background: theme.preview.text, width: "75%", marginBottom: 6, opacity: 0.9 }} />
          <div style={{ height: 5, borderRadius: 4, background: theme.preview.muted, width: "55%", marginBottom: 6 }} />
          <div style={{ height: 5, borderRadius: 4, background: theme.preview.accent, width: "35%" }} />
        </div>
        {active && (
          <div style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {locked && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
            🔒
          </div>
        )}
      </div>
      {/* Label */}
      <div style={{ padding: "10px 14px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 14 }}>{theme.emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-on-dark)" }}>{theme.name}</span>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted-on-dark)", display: "block" }}>{theme.description}</span>
      </div>
    </button>
  );
}

// ── DonateModal ───────────────────────────────────────────────────────────────

function DonateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [state, setState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  async function donate() {
    setState('pending');
    setErrMsg('');
    try {
      if (!DONATION_ADDRESS) throw new Error('Donation address not configured — set NEXT_PUBLIC_DONATION_ADDRESS in env vars.');

      const eth = (window as any).ethereum;
      if (!eth) throw new Error('No wallet found. Connect a wallet in Settings → Wallet first.');

      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      const from = accounts[0];
      if (!from) throw new Error('No wallet account available.');

      // Switch to Base mainnet (chainId 0x2105 = 8453)
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
      } catch (e: any) {
        if (e.code === 4902) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          });
        } else throw e;
      }

      // Encode ERC-20 transfer(address,uint256)
      const data =
        '0xa9059cbb' +
        DONATION_ADDRESS.replace(/^0x/, '').padStart(64, '0') +
        DONATE_AMOUNT_USDC.toString(16).padStart(64, '0');

      await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from, to: USDC_BASE, data, value: '0x0' }],
      });

      localStorage.setItem('hh_premium_unlocked', 'true');
      setState('done');
      setTimeout(onSuccess, 1200);
    } catch (err: any) {
      setErrMsg(err.message || 'Transaction failed. Please try again.');
      setState('error');
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 28, maxWidth: 400, width: '100%', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>🎨</div>
        <h2 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 20 }}>Unlock Premium Themes</h2>
        <p style={{ color: 'var(--muted-on-dark)', fontSize: 14, textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
          Support HomieHouse with a one-time <strong style={{ color: 'var(--text-on-dark)' }}>$0.50 USDC</strong> donation on Base to unlock 4 premium themes + the theme builder forever.
        </p>

        {/* What you get */}
        <div style={{ background: 'var(--bg-dark)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, border: '1px solid var(--border)' }}>
          {['🌆 Synthwave', '🌊 Ocean', '🧛 Dracula', '🌅 Sunset', '🎨 Theme Builder'].map(item => (
            <div key={item} style={{ fontSize: 13, color: 'var(--text-on-dark)', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#22c55e', fontSize: 11 }}>✓</span> {item}
            </div>
          ))}
        </div>

        {state === 'done' ? (
          <div style={{ textAlign: 'center', color: '#22c55e', fontWeight: 700, fontSize: 16, padding: 12 }}>
            ✓ Unlocked! Enjoy your new themes.
          </div>
        ) : (
          <>
            {errMsg && (
              <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12, background: 'rgba(248,113,113,0.08)', borderRadius: 8, padding: '10px 12px' }}>
                {errMsg}
              </p>
            )}
            <button
              onClick={donate}
              disabled={state === 'pending' || !DONATION_ADDRESS}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                background: !DONATION_ADDRESS ? 'var(--border)' : 'var(--btn-primary-bg)',
                color: !DONATION_ADDRESS ? 'var(--muted-on-dark)' : 'var(--btn-primary-color)',
                fontSize: 15,
                fontWeight: 700,
                cursor: state === 'pending' || !DONATION_ADDRESS ? 'not-allowed' : 'pointer',
                marginBottom: 10,
              }}
            >
              {!DONATION_ADDRESS
                ? 'Coming soon'
                : state === 'pending'
                ? 'Confirm in wallet…'
                : 'Donate $0.50 USDC on Base'}
            </button>
            <button
              onClick={onClose}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-on-dark)', fontSize: 14, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── ThemeBuilder ──────────────────────────────────────────────────────────────

function ThemeBuilder({
  colors,
  onChange,
  onApply,
  active,
}: {
  colors: CustomColors;
  onChange: (c: CustomColors) => void;
  onApply: () => void;
  active: boolean;
}) {
  const fields: { key: keyof CustomColors; label: string }[] = [
    { key: 'bgDark', label: 'Background' },
    { key: 'surface', label: 'Surface / Cards' },
    { key: 'textOnDark', label: 'Text' },
    { key: 'accent', label: 'Accent / Links' },
    { key: 'navBg', label: 'Nav Background' },
    { key: 'btnPrimaryBg', label: 'Button Background' },
    { key: 'btnPrimaryColor', label: 'Button Text' },
  ];

  // Live mini preview
  const preview = (
    <div style={{ background: colors.bgDark, borderRadius: 12, padding: 14, marginBottom: 20, border: `1px solid ${hexToRgba(colors.accent, 0.2)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: colors.surface, border: `1px solid ${hexToRgba(colors.accent, 0.3)}` }} />
        <div style={{ color: colors.textOnDark, fontSize: 13, fontWeight: 700 }}>HomieHouse Preview</div>
      </div>
      <div style={{ background: colors.surface, borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
        <div style={{ color: colors.textOnDark, fontSize: 12, marginBottom: 4 }}>This is what your feed will look like</div>
        <div style={{ color: hexToRgba(colors.textOnDark, 0.6), fontSize: 11 }}>muted text · just now</div>
      </div>
      <button style={{ background: colors.btnPrimaryBg, color: colors.btnPrimaryColor, border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'default' }}>
        Cast
      </button>
      <span style={{ color: colors.accent, fontSize: 12, marginLeft: 12 }}>@someone</span>
    </div>
  );

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 20, border: '1px solid var(--border)' }}>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted-on-dark)' }}>
        Pick your colors — the preview updates live.
      </p>
      {preview}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="color"
                value={colors[key].startsWith('#') ? colors[key].slice(0, 7) : '#ffffff'}
                onChange={(e) => onChange({ ...colors, [key]: e.target.value })}
                style={{ width: 32, height: 32, padding: 0, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'none' }}
              />
              <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>{label}</span>
            </label>
          </div>
        ))}
      </div>
      <button
        onClick={onApply}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 10,
          border: active ? '2px solid #22c55e' : '2px solid transparent',
          background: 'var(--btn-primary-bg)',
          color: 'var(--btn-primary-color)',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {active ? '✓ Custom theme active' : 'Apply Custom Theme'}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ThemesPage() {
  const router = useRouter();
  const [activeTheme, setActiveTheme] = useState("default");
  const [unlocked, setUnlocked] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [pendingTheme, setPendingTheme] = useState<string | null>(null);
  const [customColors, setCustomColors] = useState<CustomColors>(DEFAULT_CUSTOM);

  useEffect(() => {
    const saved = localStorage.getItem("hh_theme") || "default";
    setActiveTheme(saved);
    setUnlocked(localStorage.getItem("hh_premium_unlocked") === "true");
    try {
      const raw = localStorage.getItem("hh_custom_theme");
      if (raw) setCustomColors(JSON.parse(raw));
    } catch {}
  }, []);

  // Live-update preview when customColors change (only if custom theme is active)
  useEffect(() => {
    if (activeTheme === 'custom') {
      applyCustomThemeVars(colorsToVars(customColors));
    }
  }, [customColors, activeTheme]);

  function applyTheme(id: string) {
    clearCustomThemeVars();
    setActiveTheme(id);
    localStorage.setItem("hh_theme", id);
    if (id === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", id);
    }
  }

  function handlePremiumClick(id: string) {
    if (unlocked) {
      applyTheme(id);
    } else {
      setPendingTheme(id);
      setShowDonateModal(true);
    }
  }

  function handleDonateSuccess() {
    setUnlocked(true);
    setShowDonateModal(false);
    if (pendingTheme) {
      applyTheme(pendingTheme);
      setPendingTheme(null);
    }
  }

  function applyCustomTheme() {
    const vars = colorsToVars(customColors);
    clearCustomThemeVars();
    document.documentElement.removeAttribute('data-theme');
    applyCustomThemeVars(vars);
    localStorage.setItem('hh_theme', 'custom');
    localStorage.setItem('hh_custom_theme', JSON.stringify(customColors));
    setActiveTheme('custom');
  }

  const sectionLabel = (text: string, badge?: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-on-dark)' }}>{text}</h2>
      {badge}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", color: "var(--text-on-dark)", paddingBottom: 100 }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "var(--bg-dark)", zIndex: 10 }}>
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", color: "var(--muted-on-dark)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Theme</h1>
        {unlocked && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(34,197,94,0.25)' }}>
            ✓ Premium unlocked
          </span>
        )}
      </header>

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>

        {/* Free Themes */}
        <section style={{ marginBottom: 32 }}>
          {sectionLabel('Free Themes')}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {FREE_THEMES.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                active={activeTheme === theme.id}
                onClick={() => applyTheme(theme.id)}
              />
            ))}
          </div>
        </section>

        {/* Premium Themes */}
        <section style={{ marginBottom: 32 }}>
          {sectionLabel(
            'Premium Themes',
            unlocked ? (
              <span style={{ fontSize: 12, color: '#22c55e' }}>✓ Unlocked</span>
            ) : (
              <button
                onClick={() => setShowDonateModal(true)}
                style={{ fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted-on-dark)', padding: '4px 10px', borderRadius: 20, cursor: 'pointer' }}
              >
                🔒 $0.50 USDC on Base
              </button>
            )
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {PREMIUM_THEMES.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                active={activeTheme === theme.id}
                locked={!unlocked}
                onClick={() => handlePremiumClick(theme.id)}
              />
            ))}
          </div>
          {!unlocked && (
            <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--muted-on-dark)', textAlign: 'center' }}>
              One-time donation unlocks all premium themes + theme builder forever
            </p>
          )}
        </section>

        {/* Theme Builder */}
        <section>
          {sectionLabel(
            'Theme Builder',
            unlocked ? null : (
              <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>🔒 Premium</span>
            )
          )}
          {unlocked ? (
            <ThemeBuilder
              colors={customColors}
              onChange={setCustomColors}
              onApply={applyCustomTheme}
              active={activeTheme === 'custom'}
            />
          ) : (
            <button
              onClick={() => setShowDonateModal(true)}
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '2px dashed var(--border)',
                borderRadius: 14,
                padding: '28px 20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 32 }}>🎨</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-on-dark)' }}>Build your own theme</span>
              <span style={{ fontSize: 12, color: 'var(--muted-on-dark)' }}>Unlock with Premium to customize every color</span>
            </button>
          )}
        </section>
      </main>

      {showDonateModal && (
        <DonateModal
          onClose={() => { setShowDonateModal(false); setPendingTheme(null); }}
          onSuccess={handleDonateSuccess}
        />
      )}
    </div>
  );
}
