"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

function truncate(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function WalletPage() {
  const router = useRouter();
  const { user, linkWallet, unlinkWallet, authenticated } = usePrivy();

  const wallets = user?.linkedAccounts?.filter((a: any) => a.type === "wallet") ?? [];

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
          Wallets linked to your HomieHouse account
        </p>

        {/* Connected wallets */}
        <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 16 }}>
          {wallets.length === 0 ? (
            <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--muted-on-dark)", fontSize: 14 }}>
              No wallets linked yet
            </div>
          ) : (
            wallets.map((w: any, i: number) => (
              <div
                key={w.address}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px",
                  borderBottom: i < wallets.length - 1 ? "1px solid var(--border)" : "none",
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
                    {w.walletClientType || "External wallet"}
                  </div>
                </div>
                <button
                  onClick={() => unlinkWallet(w.address)}
                  style={{ background: "none", border: "none", color: "var(--muted-on-dark)", cursor: "pointer", fontSize: 12, padding: "4px 8px" }}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add wallet */}
        {authenticated && (
          <button
            onClick={() => linkWallet()}
            style={{
              width: "100%", padding: "14px 16px",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              color: "var(--text-on-dark)", fontSize: 14, fontWeight: 600,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Link a wallet
          </button>
        )}
      </main>
    </div>
  );
}
