"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useFarcasterAuth } from "@/lib/farcaster-auth";
import { registerHypersnapSigner, type KeyAddSigningPayload } from "@/lib/hypersnap-signer-client";
import { MAX_DISPLAY_NAME_BYTES, publishDisplayName } from "@/lib/profile-publish";
import styles from "./FarcasterOnboarding.module.css";

type Step = "welcome" | "username" | "signing" | "creating" | "done" | "starter" | "error" | "no-wallet";

// ── Starter Pack ──
const STARTER_CHANNELS = [
  { id: "farcaster", label: "Decentralized Social", emoji: "🟣", description: "Protocol news & the core community" },
  { id: "defi", label: "DeFi", emoji: "💧", description: "Decentralized finance, yields, protocols" },
  { id: "web3", label: "Web3", emoji: "🌐", description: "Broader web3 builders & discussion" },
  { id: "base", label: "Base", emoji: "🔵", description: "Base chain apps & ecosystem" },
  { id: "dao", label: "DAOs", emoji: "🏛️", description: "Governance, coordination, DAOs" },
  { id: "nft", label: "NFTs", emoji: "🖼️", description: "NFTs beyond art — tickets, memberships" },
];

interface CreatingStatus {
  fid: boolean;
  signer: boolean;
}

/** Published as the profile's display name (Hypersnap has no native @username yet). */
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N}_ .'-]{1,32}$/u;

function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  return DISPLAY_NAME_PATTERN.test(trimmed) && new TextEncoder().encode(trimmed).length <= MAX_DISPLAY_NAME_BYTES;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function signTypedData(
  provider: any,
  address: string,
  domain: object,
  types: object,
  primaryType: string,
  message: object,
): Promise<string> {
  return provider.request({
    method: "eth_signTypedData_v4",
    params: [
      address,
      JSON.stringify({ domain, types, primaryType, message }),
    ],
  });
}

// ── Name step ─────────────────────────────────────────────────────────────────

function NameStep({
  name,
  setName,
  onNext,
}: {
  name: string;
  setName: (v: string) => void;
  onNext: () => void;
}) {
  const canNext = isValidDisplayName(name);

  return (
    <>
      <p style={{ color: "var(--muted-on-dark)", fontSize: 14, margin: "0 0 20px", lineHeight: 1.5 }}>
        Pick a display name (max 32 characters). Hypersnap accounts don&apos;t have @usernames yet, so your account is identified by its ID number.
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 32))}
        placeholder="Your name"
        maxLength={32}
        aria-label="Display name"
        style={{
          width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10, fontSize: 15, marginBottom: 12,
          border: "1px solid var(--border)", background: "var(--bg-dark)", color: "var(--text-on-dark)",
        }}
      />
      <button
        onClick={onNext}
        disabled={!canNext}
        style={{
          width: "100%", padding: 14, borderRadius: 12, border: "none",
          background: canNext ? "var(--btn-primary-bg)" : "var(--border)",
          color: canNext ? "var(--btn-primary-color)" : "var(--muted-on-dark)",
          fontSize: 15, fontWeight: 700, cursor: canNext ? "pointer" : "not-allowed",
        }}
      >
        Continue →
      </button>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FarcasterOnboarding() {
  const { fid: authFid } = useFarcasterAuth();
  const { address: connectedAddress, connector, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { openConnectModal } = useConnectModal();
  const panelRef = useRef<HTMLDivElement>(null);

  const [show, setShow] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<CreatingStatus>({ fid: false, signer: false });
  const [error, setError] = useState("");
  const [signerWarning, setSignerWarning] = useState("");
  const [newFid, setNewFid] = useState<number | null>(null);
  const [starterPicks, setStarterPicks] = useState<Set<string>>(new Set(STARTER_CHANNELS.map((c) => c.id)));

  useEffect(() => {
    const handleNeedAccount = () => setShow(true);
    window.addEventListener("hh:need:farcaster-account", handleNeedAccount);
    return () => window.removeEventListener("hh:need:farcaster-account", handleNeedAccount);
  }, []);

  useEffect(() => {
    if (!show) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const getFocusable = () => panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [];
    getFocusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShow(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [show]);

  // Use the active wagmi connector, supporting injected wallets and WalletConnect.
  async function getEthProvider() {
    if (!isConnected || !connectedAddress || !connector) {
      openConnectModal?.();
      throw new Error("Connect a wallet to continue account creation.");
    }
    const provider = await connector.getProvider() as any;

    // The native registration signature uses chainId 10 in its EIP-712
    // domain, and many wallets only sign typed data for the active chain.
    try {
      if (chainId !== 10) await switchChainAsync({ chainId: 10 });
    } catch (switchErr: any) {
      if (switchErr?.code === 4902) {
        throw new Error("Please add the Optimism network to your wallet.");
      }
      throw switchErr;
    }

    return { provider, address: connectedAddress };
  }

  async function createAccount() {
    setStep("signing");
    setError("");

    try {
      const { provider, address: custodyAddress } = await getEthProvider();

      // 1. Ask HomieHouse to prepare a native Hypersnap registration. The
      // server mines the proof of work (a few seconds); no gas is spent.
      const prepRes = await fetch(`/api/create-account?address=${custodyAddress}`, { cache: "no-store" });
      const prep = await prepRes.json().catch(() => ({}));
      if (!prepRes.ok) throw new Error(prep.error || "Failed to prepare registration");

      let fid: number | null = typeof prep.existingFid === "number" ? prep.existingFid : null;
      if (!fid) {
        // 2. One wallet signature authorizes the new account (not a transaction).
        const custodySignature = await signTypedData(
          provider,
          custodyAddress,
          prep.typedData.domain,
          prep.typedData.types,
          prep.typedData.primaryType,
          prep.typedData.message,
        );

        // 3. Submit it; shard 0 assigns the FID in the next block or two.
        setStep("creating");
        const createRes = await fetch("/api/create-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proof: prep.proof, custodySignature }),
        });
        const result = await createRes.json().catch(() => ({}));
        if (!createRes.ok || !result.ok) throw new Error(result.error || "Registration failed");
        fid = typeof result.fid === "number" ? result.fid : null;

        for (let attempt = 0; !fid && attempt < 15; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 2_000));
          const lookupRes = await fetch(`/api/create-account?lookup=${custodyAddress}`, { cache: "no-store" });
          const lookup = await lookupRes.json().catch(() => ({}));
          if (typeof lookup.fid === "number") fid = lookup.fid;
        }
        if (!fid) {
          throw new Error("Your registration was sent but Hypersnap hasn't confirmed it yet. Wait a minute, then try again with the same wallet.");
        }
      } else {
        setStep("creating");
      }

      setStatus({ fid: true, signer: false });
      setNewFid(fid);
      const name = displayName.trim();
      const result = { fid };

      // 6. Persist identity, then enroll a narrowly-scoped Hypersnap signer.
      const newProfile = {
        fid:          result.fid,
        username:     "",
        displayName:  name,
        pfpUrl:       "",
        bio:          "",
        signer_uuid:  "",
        verified_addresses: { eth_addresses: [custodyAddress] },
      };
      localStorage.setItem("hh_profile", JSON.stringify(newProfile));
      window.dispatchEvent(new Event("hh:auth:changed"));

      try {
        const signer = await registerHypersnapSigner(
          Number(result.fid),
          custodyAddress,
          async (payload: KeyAddSigningPayload) => signTypedData(
            provider,
            custodyAddress,
            payload.domain,
            payload.types,
            payload.primaryType,
            {
              fid: payload.message.fid.toString(),
              key: payload.message.key,
              keyType: payload.message.keyType,
              scopes: payload.message.scopes,
              ttl: payload.message.ttl,
              nonce: payload.message.nonce,
              deadline: payload.message.deadline.toString(),
            },
          ) as Promise<`0x${string}`>,
        );
        const signerRecord = {
          public_key: `0x${signer.publicKeyHex}`,
          private_key: signer.privateKeyHex,
          status: "pending_hypersnap",
          registration: "hypersnap-key-add",
          signer_uuid: null,
        };
        localStorage.setItem(`signer_${result.fid}`, JSON.stringify(signerRecord));
        let active = false;
        const activationDelays = [0, 1_000, 1_500, 2_500, 4_000, 6_000, 8_000, 10_000];
        for (const delay of activationDelays) {
          if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
          const response = await fetch(`/api/hypersnap/signer?fid=${result.fid}&publicKey=${encodeURIComponent(signerRecord.public_key)}`, { cache: "no-store" });
          const data = await response.json().catch(() => ({}));
          if (data.ok && data.active) {
            signerRecord.status = "approved";
            localStorage.setItem(`signer_${result.fid}`, JSON.stringify(signerRecord));
            active = true;
            break;
          }
        }
        setStatus({ fid: true, signer: active });
        if (active) {
          window.dispatchEvent(new Event("hh:signer:approved"));
          // Publish the display name so other people see it (best-effort).
          const published = await publishDisplayName(Number(result.fid), name, signer.privateKeyHex);
          if (!published.ok) {
            console.warn("Display name was not published:", published.error);
            setSignerWarning("Your account is ready, but your display name couldn't be published yet, so others may see your ID number for now.");
          }
        } else {
          setSignerWarning("The FID is created and the Hypersnap key request was submitted, but activation is still pending. You can check again from the posting setup prompt.");
          window.dispatchEvent(new CustomEvent("hh:request:signer", { detail: { fid: Number(result.fid) } }));
        }
      } catch (signerErr: any) {
        console.error("Hypersnap signer enrollment failed after FID creation:", signerErr);
        setSignerWarning(signerErr?.message || "The FID was created, but Hypersnap posting still needs wallet authorization.");
        window.dispatchEvent(new CustomEvent("hh:request:signer", { detail: { fid: Number(result.fid) } }));
      }

      setStep("done");
    } catch (err: any) {
      console.error("Account creation error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setStep("error");
    }
  }

  function toggleStarterChannel(id: string) {
    setStarterPicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function finishOnboarding(picks: Set<string>) {
    if (picks.size > 0) {
      try {
        const existingRaw = localStorage.getItem("hh_feed_interests");
        const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
        const merged = [...new Set([...existing, ...picks])];
        localStorage.setItem("hh_feed_interests", JSON.stringify(merged));
      } catch {
        // localStorage unavailable — not fatal
      }
    }
    setShow(false);
    window.location.reload();
  }

  if (!show) return null;

  return (
    <div className={styles.overlay}>
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-label="Create your HomieHouse identity" tabIndex={-1}>
        <div key={step} className={styles.step}>
        {/* Welcome */}
        {step === "welcome" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🟣</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>Create your HomieHouse identity</h2>
              <p style={{ color: "var(--muted-on-dark)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                Your account is created directly on Hypersnap. HomieHouse then adds a scoped posting key, with no separate app approval or recovery phrase.
              </p>
            </div>
            <div style={{ background: "var(--bg-dark)", borderRadius: 12, padding: "14px 16px", marginBottom: 24, border: "1px solid var(--border)" }}>
              {[
                ["🪪", "Permanent ID", "Your Hypersnap ID belongs to your wallet"],
                ["✍️",  "Approve with wallet", "2 signature prompts; no recovery phrase"],
                ["💸", "Free", "No ETH or gas needed"],
              ].map(([icon, label, sub]) => (
                <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "6px 0" }}>
                  <span style={{ fontSize: 18, minWidth: 24, textAlign: "center" }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-on-dark)" }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                if (isConnected && connectedAddress) {
                  setStep("username");
                } else {
                  openConnectModal?.();
                }
              }}
              style={{
                width: "100%", padding: 14, borderRadius: 12, border: "none",
                background: "var(--btn-primary-bg)", color: "var(--btn-primary-color)",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}
            >
              Get started →
            </button>
            <button
              onClick={() => setShow(false)}
              style={{
                width: "100%", padding: 10, borderRadius: 10, border: "none",
                background: "transparent", color: "var(--muted-on-dark)", cursor: "pointer",
                fontSize: 13, marginTop: 8,
              }}
            >
              I already have a social account
            </button>
          </>
        )}

        {/* No wallet */}
        {step === "no-wallet" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🦊</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Wallet required</h2>
            <p style={{ color: "var(--muted-on-dark)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Connect a wallet with RainbowKit or WalletConnect to sign your Hypersnap registration. HomieHouse will not ask for your recovery phrase.
            </p>
            <button
              onClick={() => window.open("https://metamask.io", "_blank")}
              style={{
                width: "100%", padding: 14, borderRadius: 12, border: "none",
                background: "var(--btn-primary-bg)", color: "var(--btn-primary-color)",
                fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8,
              }}
            >
              Connect wallet →
            </button>
            <button
              onClick={() => setShow(false)}
              style={{ background: "transparent", border: "none", color: "var(--muted-on-dark)", cursor: "pointer", fontSize: 13, padding: 8 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Display name */}
        {step === "username" && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Choose your name</h2>
            <NameStep name={displayName} setName={setDisplayName} onNext={createAccount} />
            <button
              onClick={() => setStep("welcome")}
              style={{ background: "transparent", border: "none", color: "var(--muted-on-dark)", cursor: "pointer", fontSize: 13, padding: "8px 0", marginTop: 8 }}
            >
              ← Back
            </button>
          </>
        )}

        {/* Signing */}
        {step === "signing" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✍️</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Sign to create your identity</h2>
            <p style={{ color: "var(--muted-on-dark)", fontSize: 14, lineHeight: 1.5 }}>
              HomieHouse is preparing your registration (a few seconds). Then your wallet will ask you to sign the account registration and a scoped Hypersnap posting key. Neither is a transaction.
            </p>
            <div role="status" aria-live="polite" style={{ marginTop: 16, fontSize: 13, color: "var(--muted-on-dark)" }}>
              Check your wallet for signature requests…
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <div className={styles.spinner} aria-hidden="true" style={{ width: 24, height: 24, border: "3px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%" }} />
            </div>
          </div>
        )}

        {/* Creating */}
        {step === "creating" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⛓️</div>
            <h2 aria-live="polite" style={{ margin: "0 0 16px", fontSize: 20 }}>Creating your account…</h2>
            <p style={{ color: "var(--muted-on-dark)", fontSize: 13, marginBottom: 20 }}>
              Registering on Hypersnap. This usually takes a few seconds.
            </p>
            {[
              { key: "fid",    label: "Creating your Hypersnap ID" },
              { key: "signer", label: "Registering scoped Hypersnap key" },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 14 }}>
                {status[key as keyof CreatingStatus] ? (
                  <span style={{ color: "#22c55e", fontSize: 16 }}>✓</span>
                ) : (
                  <div className={styles.spinner} aria-hidden="true" style={{ width: 16, height: 16, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", flexShrink: 0 }} />
                )}
                <span style={{ color: status[key as keyof CreatingStatus] ? "#22c55e" : "var(--muted-on-dark)" }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>Welcome to HomieHouse!</h2>
            <p style={{ color: "var(--muted-on-dark)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Your account <strong style={{ color: "var(--text-on-dark)" }}>{displayName.trim()}</strong> (FID {newFid}) is live on Hypersnap.
            </p>
            <div style={{ background: "var(--bg-dark)", borderRadius: 12, padding: "12px 16px", marginBottom: 24, border: "1px solid var(--border)", textAlign: "left" }}>
              {[
                ["Hypersnap ID created", status.fid],
                ["Hypersnap signer active", status.signer],
              ].map(([label, ok]) => (
                <div key={label as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                  <span style={{ color: "var(--muted-on-dark)" }}>{label as string}</span>
                  <span style={{ color: ok ? "#22c55e" : "#f87171" }}>{ok ? "✓" : "needs retry"}</span>
                </div>
              ))}
            </div>
            {signerWarning && (
              <p role="status" style={{ fontSize: 12, color: "#fbbf24", marginBottom: 16 }}>
                {signerWarning}
              </p>
            )}
            <button
              onClick={() => setStep("starter")}
              style={{
                width: "100%", padding: 14, borderRadius: 12, border: "none",
                background: "var(--btn-primary-bg)", color: "var(--btn-primary-color)",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Starter Pack */}
        {step === "starter" && (
          <div style={{ padding: "4px 0" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📦</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Pick a few interests</h2>
              <p style={{ color: "var(--muted-on-dark)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                Your feed is empty until you follow people or channels. These give it something to show you right away — change them anytime in your feed settings.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {STARTER_CHANNELS.map((ch) => {
                const picked = starterPicks.has(ch.id);
                return (
                  <button
                    key={ch.id}
                    onClick={() => toggleStarterChannel(ch.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                      padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                      border: `1.5px solid ${picked ? "var(--accent)" : "var(--border)"}`,
                      background: picked ? "rgba(99,102,241,0.08)" : "var(--bg-dark)",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{ch.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-on-dark)" }}>{ch.label}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-on-dark)" }}>{ch.description}</div>
                    </div>
                    <span
                      style={{
                        flexShrink: 0, width: 20, height: 20, borderRadius: 6,
                        border: `2px solid ${picked ? "var(--accent)" : "var(--border)"}`,
                        background: picked ? "var(--accent)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {picked && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="var(--bg-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => finishOnboarding(starterPicks)}
              style={{
                width: "100%", padding: 14, borderRadius: 12, border: "none",
                background: "var(--btn-primary-bg)", color: "var(--btn-primary-color)",
                fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8,
              }}
            >
              {starterPicks.size > 0 ? `Start exploring (${starterPicks.size} picked) →` : "Start exploring →"}
            </button>
            <button
              onClick={() => finishOnboarding(new Set())}
              style={{
                width: "100%", padding: 10, borderRadius: 10, border: "none",
                background: "transparent", color: "var(--muted-on-dark)", cursor: "pointer", fontSize: 13,
              }}
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Something went wrong</h2>
            <p style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#f87171", textAlign: "left", marginBottom: 20 }}>
              {error}
            </p>
            <button
              onClick={() => setStep("username")}
              style={{
                width: "100%", padding: 14, borderRadius: 12, border: "none",
                background: "var(--btn-primary-bg)", color: "var(--btn-primary-color)",
                fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8,
              }}
            >
              Try again
            </button>
            <button
              onClick={() => setShow(false)}
              style={{ background: "transparent", border: "none", color: "var(--muted-on-dark)", cursor: "pointer", fontSize: 13, padding: 8 }}
            >
              Dismiss
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
