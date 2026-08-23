"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

function truncate(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function WalletPage() {
  const router = useRouter();
  const [wallets, setWallets] = useState<any[]>([]);

  // Load wallets from stored profile
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hh_profile');
      if (stored) {
        const profile = JSON.parse(stored);
        const ethAddresses = profile.verified_addresses?.eth_addresses || [];
        const custodyAddr = profile.custody_address;
        const allAddresses = [...new Set([...(custodyAddr ? [custodyAddr] : []), ...ethAddresses])];
        setWallets(allAddresses.map((addr: string) => ({ type: "wallet", address: addr })));
      }
    } catch {}
  }, []);

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
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Wallet</h1>
      </header>

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted-on-dark)" }}>
          Wallets linked to your Farcaster account
        </p>

        {wallets.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted-on-dark)", fontSize: 14 }}>
            No verified wallets found for your Farcaster account.
          </div>
        ) : (
          <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            {wallets.map((w: any) => (
              <div
                key={w.address}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px",
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg-dark)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-on-dark)" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a1 1 0 100 2 1 1 0 000-2z" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-on-dark)", fontFamily: "monospace" }}>
                    {truncate(w.address)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-on-dark)", marginTop: 2 }}>
                    Verified address
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}