"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const THEMES = [
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
    preview: { bg: "#000000", surface: "#1a1a1a", text: "#FFFFFF", accent: "#FF8C00", muted: "rgba(255,255,255,0.5)" },
  },
];

export default function ThemesPage() {
  const router = useRouter();
  const [activeTheme, setActiveTheme] = useState("default");

  useEffect(() => {
    const saved = localStorage.getItem("hh_theme") || "default";
    setActiveTheme(saved);
  }, []);

  function applyTheme(id: string) {
    setActiveTheme(id);
    localStorage.setItem("hh_theme", id);
    if (id === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", id);
    }
  }

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
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Theme</h1>
      </header>

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted-on-dark)" }}>
          Choose a theme for HomieHouse
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {THEMES.map((theme) => {
            const active = activeTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => applyTheme(theme.id)}
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
                }}
              >
                <div style={{ background: theme.preview.bg, padding: "14px 14px 10px", position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: theme.preview.muted }} />
                    <div style={{ height: 8, borderRadius: 4, background: theme.preview.muted, width: 60, opacity: 0.7 }} />
                  </div>
                  <div style={{ background: theme.preview.surface, borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ height: 7, borderRadius: 4, background: theme.preview.text, width: "75%", marginBottom: 6, opacity: 0.9 }} />
                    <div style={{ height: 5, borderRadius: 4, background: theme.preview.muted, width: "55%", marginBottom: 6 }} />
                    <div style={{ height: 5, borderRadius: 4, background: theme.preview.muted, width: "40%" }} />
                  </div>
                  {active && (
                    <div style={{
                      position: "absolute", top: 8, right: 8,
                      width: 20, height: 20, borderRadius: "50%",
                      background: "#22c55e",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <div style={{ padding: "10px 14px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 14 }}>{theme.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-on-dark)" }}>{theme.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted-on-dark)", display: "block" }}>{theme.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
