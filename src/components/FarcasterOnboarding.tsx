"use client";

import { useState, useEffect } from "react";
import { useFarcasterAuth } from "@/lib/farcaster-auth";
import { ed25519 } from "@noble/curves/ed25519";

// ── Farcaster EIP-712 domains ─────────────────────────────────────────────────
const ID_GATEWAY_DOMAIN = {
  name: "Farcaster IdGateway",
  version: "1",
  chainId: 10,
  verifyingContract: "0x00000000Fc25870C6eD6b6c7E41Fb078b7656f69",
};

const KEY_REGISTRY_DOMAIN = {
  name: "Farcaster KeyRegistry",
  version: "1",
  chainId: 10,
  verifyingContract: "0x00000000Fc1237824fb747aBDE0FF18990E59b7e",
};

const FNAME_DOMAIN = {
  name: "Farcaster name verification",
  version: "1",
  chainId: 1,
  verifyingContract: "0xe3Be01D99bAa8dB9905b33a3cA391238234B79D1",
};

type Step = "welcome" | "username" | "signing" | "creating" | "done" | "starter" | "error" | "no-wallet";

// ── Starter Pack ──
const STARTER_CHANNELS = [
  { id: "farcaster", label: "Farcaster", emoji: "🟣", description: "Protocol news & the core community" },
  { id: "defi", label: "DeFi", emoji: "💧", description: "Decentralized finance, yields, protocols" },
  { id: "web3", label: "Web3", emoji: "🌐", description: "Broader web3 builders & discussion" },
  { id: "base", label: "Base", emoji: "🔵", description: "Base chain apps & ecosystem" },
  { id: "dao", label: "DAOs", emoji: "🏛️", description: "Governance, coordination, DAOs" },
  { id: "nft", label: "NFTs", emoji: "🖼️", description: "NFTs beyond art — tickets, memberships" },
];

interface CreatingStatus {
  fid: boolean;
  signer: boolean;
  fname: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buf2hex(b: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(b).toString("hex")}` as `0x${string}`;
}

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

// ── Username step ─────────────────────────────────────────────────────────────

function UsernameStep({
  username,
  setUsername,
  available,
  checking,
  onCheck,
  onNext,
}: {
  username: string;
  setUsername: (v: string) => void;
  available: boolean | null;
  checking: boolean;
  onCheck: () => void;
  onNext: () => void;
}) {
  const valid = /^[a-zA-Z0-9_]{1,16}$/.test(username);
  const canNext = valid && available === true;

  return (
    <>
      <p style={{ color: "var(--muted-on-dark)", fontSize: 14, margin: "0 0 20px", lineHeight: 1.5 }}>
        Pick your Farcaster username. It can only contain letters, numbers, and underscores (max 16 chars).
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); }}
          placeholder="your_username"
          maxLength={16}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 15, fontFamily: "monospace",
            border: `1px solid ${available === false ? "#f87171" : available === true ? "#22c55e" : "var(--border)"}`,
            background: "var(--bg-dark)", color: "var(--text-on-dark)",
          }}
        />
        <button
          onClick={onCheck}
          disabled={!valid || checking}
          style={{
            padding: "10px 16px", borderRadius: 10, border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text-on-dark)", cursor: "pointer",
            fontSize: 13, whiteSpace: "nowrap",
          }}
        >
          {checking ? "…" : "Check"}
        </button>
      </div>
      {available === false && (
        <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 12px" }}>Username taken — try another.</p>
      )}
      {available === true && (
        <p style={{ color: "#22c55e", fontSize: 13, margin: "0 0 12px" }}>✓ Available!</p>
      )}
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

  const [show, setShow] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [username, setUsername] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<CreatingStatus>({ fid: false, signer: false, fname: false });
  const [error, setError] = useState("");
  const [newFid, setNewFid] = useState<number | null>(null);
  const [starterPicks, setStarterPicks] = useState<Set<string>>(new Set(STARTER_CHANNELS.map((c) => c.id)));

  useEffect(() => {
    const handleNeedAccount = () => setShow(true);
    window.addEventListener("hh:need:farcaster-account", handleNeedAccount);
    return () => window.removeEventListener("hh:need:farcaster-account", handleNeedAccount);
  }, []);

  async function checkAvailability() {
    if (!username) return;
    setChecking(true);
    setAvailable(null);
    try {
      const res = await fetch(`/api/create-account?checkFname=${encodeURIComponent(username)}`);
      const data = await res.json();
      setAvailable(data.available);
    } catch {
      setAvailable(false);
    } finally {
      setChecking(false);
    }
  }

  // Get browser wallet provider (MetaMask, Rainbow, etc.)
  async function getEthProvider() {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error("No wallet detected. Please install MetaMask or another browser wallet.");
    }
    const provider = (window as any).ethereum;

    // Request accounts
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found. Please unlock your wallet.");
    }
    const address = accounts[0];

    // Switch to Optimism
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xa" }], // 10 = Optimism
      });
    } catch (switchErr: any) {
      if (switchErr.code === 4902) {
        throw new Error("Please add the Optimism network to your wallet.");
      }
      throw switchErr;
    }

    return { provider, address };
  }

  async function createAccount() {
    setStep("signing");
    setError("");

    try {
      const { provider, address: custodyAddress } = await getEthProvider();

      // 1. Generate Ed25519 signer keypair
      const signerPrivBytes = ed25519.utils.randomPrivateKey();
      const signerPubBytes  = ed25519.getPublicKey(signerPrivBytes);
      const signerPublicKey  = buf2hex(signerPubBytes);
      const signerPrivateKey = Buffer.from(signerPrivBytes).toString("hex");

      // 2. Pick deadlines (24 h from now)
      const now = Math.floor(Date.now() / 1000);
      const registerDeadline = now + 86_400;
      const keyAddDeadline   = now + 86_400;
      const fnameTimestamp   = now;

      // 3. Fetch nonces + price + signed key request metadata from server
      const prepRes = await fetch(
        `/api/create-account?address=${custodyAddress}&signerKey=${signerPublicKey}&deadline=${keyAddDeadline}`,
      );
      if (!prepRes.ok) {
        const err = await prepRes.json();
        throw new Error(err.error || "Failed to prepare registration");
      }
      const prep = await prepRes.json();
      const { registerNonce, keyAddNonce, signedKeyRequestMetadata } = prep;

      // 4. Sign Register EIP-712 (IdGateway, Optimism)
      const registerSig = await signTypedData(
        provider,
        custodyAddress,
        ID_GATEWAY_DOMAIN,
        {
          Register: [
            { name: "to",       type: "address" },
            { name: "recovery", type: "address" },
            { name: "nonce",    type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        "Register",
        {
          to:       custodyAddress,
          recovery: custodyAddress,
          nonce:    registerNonce,
          deadline: String(registerDeadline),
        },
      );

      // 5. Sign Add EIP-712 (KeyRegistry, Optimism)
      const keyAddSig = await signTypedData(
        provider,
        custodyAddress,
        KEY_REGISTRY_DOMAIN,
        {
          Add: [
            { name: "owner",        type: "address" },
            { name: "keyType",      type: "uint32"  },
            { name: "key",          type: "bytes"   },
            { name: "metadataType", type: "uint32"  },
            { name: "metadata",     type: "bytes"   },
            { name: "nonce",        type: "uint256" },
            { name: "deadline",     type: "uint256" },
          ],
        },
        "Add",
        {
          owner:        custodyAddress,
          keyType:      1,
          key:          signerPublicKey,
          metadataType: 1,
          metadata:     signedKeyRequestMetadata,
          nonce:        keyAddNonce,
          deadline:     String(keyAddDeadline),
        },
      );

      // 6. Sign UserNameProof EIP-712 (fname, Ethereum mainnet domain)
      const fnameSig = await signTypedData(
        provider,
        custodyAddress,
        FNAME_DOMAIN,
        {
          UserNameProof: [
            { name: "name",      type: "string"  },
            { name: "timestamp", type: "uint256" },
            { name: "owner",     type: "address" },
          ],
        },
        "UserNameProof",
        { name: username, timestamp: String(fnameTimestamp), owner: custodyAddress },
      );

      // 7. Call server to execute all on-chain actions
      setStep("creating");

      const createRes = await fetch("/api/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custodyAddress,
          signerPublicKey,
          signedKeyRequestMetadata,
          registerSig,
          registerDeadline,
          keyAddSig,
          keyAddDeadline,
          fnameSig,
          fnameTimestamp,
          username,
        }),
      });

      const result = await createRes.json();
      if (!createRes.ok || !result.ok) {
        throw new Error(result.error || "Registration failed");
      }

      setStatus({ fid: true, signer: !!result.signerTxHash, fname: result.fnameRegistered });
      setNewFid(result.fid);

      // 8. Persist signer key + update profile
      const signerRecord = {
        public_key:  signerPublicKey,
        private_key: signerPrivateKey,
        status:      result.signerTxHash ? "approved" : "pending_approval",
        signer_uuid: null,
      };
      localStorage.setItem(`signer_${result.fid}`, JSON.stringify(signerRecord));

      const newProfile = {
        fid:          result.fid,
        username:     username,
        displayName:  username,
        pfpUrl:       "",
        bio:          "",
        signer_uuid:  signerPublicKey,
        verified_addresses: { eth_addresses: [custodyAddress] },
      };
      localStorage.setItem("hh_profile", JSON.stringify(newProfile));
      window.dispatchEvent(new Event("hh:auth:changed"));

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
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--surface)", borderRadius: 24, padding: "32px 28px",
          maxWidth: 440, width: "100%", border: "1px solid var(--border)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Welcome */}
        {step === "welcome" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🟣</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>Create your Farcaster account</h2>
              <p style={{ color: "var(--muted-on-dark)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                Farcaster is a decentralized social protocol. Your account lives on-chain — no single company controls it.
              </p>
            </div>
            <div style={{ background: "var(--bg-dark)", borderRadius: 12, padding: "14px 16px", marginBottom: 24, border: "1px solid var(--border)" }}>
              {[
                ["🪪", "Permanent ID", "Your FID is minted on Optimism"],
                ["✍️",  "Sign messages", "3 quick wallet signatures"],
                ["💸", "App covers gas", "No ETH needed — HomieHouse pays"],
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
                // Check if browser wallet is available
                if (typeof window !== 'undefined' && (window as any).ethereum) {
                  setStep("username");
                } else {
                  setStep("no-wallet");
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
              I already have a Farcaster account
            </button>
          </>
        )}

        {/* No wallet */}
        {step === "no-wallet" && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🦊</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Wallet required</h2>
            <p style={{ color: "var(--muted-on-dark)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Creating a Farcaster account requires a browser wallet (MetaMask, Rainbow, etc.) to sign on-chain registration messages. Please install a wallet extension and try again.
            </p>
            <button
              onClick={() => window.open("https://metamask.io", "_blank")}
              style={{
                width: "100%", padding: 14, borderRadius: 12, border: "none",
                background: "var(--btn-primary-bg)", color: "var(--btn-primary-color)",
                fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8,
              }}
            >
              Get MetaMask →
            </button>
            <button
              onClick={() => setShow(false)}
              style={{ background: "transparent", border: "none", color: "var(--muted-on-dark)", cursor: "pointer", fontSize: 13, padding: 8 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Username */}
        {step === "username" && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Choose a username</h2>
            <UsernameStep
              username={username}
              setUsername={(v) => { setUsername(v); setAvailable(null); }}
              available={available}
              checking={checking}
              onCheck={checkAvailability}
              onNext={createAccount}
            />
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
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Sign to create account</h2>
            <p style={{ color: "var(--muted-on-dark)", fontSize: 14, lineHeight: 1.5 }}>
              Your wallet will ask you to sign <strong style={{ color: "var(--text-on-dark)" }}>3 messages</strong> — no ETH required, just authorization.
            </p>
            <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted-on-dark)" }}>
              Check your wallet for signature requests…
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <div style={{ width: 24, height: 24, border: "3px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Creating */}
        {step === "creating" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⛓️</div>
            <h2 style={{ margin: "0 0 16px", fontSize: 20 }}>Creating your account…</h2>
            <p style={{ color: "var(--muted-on-dark)", fontSize: 13, marginBottom: 20 }}>
              Writing to Optimism — this takes about 5–10 seconds.
            </p>
            {[
              { key: "fid",    label: "Minting your FID" },
              { key: "signer", label: "Registering signer key" },
              { key: "fname",  label: `Claiming @${username}` },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 14 }}>
                {status[key as keyof CreatingStatus] ? (
                  <span style={{ color: "#22c55e", fontSize: 16 }}>✓</span>
                ) : (
                  <div style={{ width: 16, height: 16, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
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
            <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>Welcome to Farcaster!</h2>
            <p style={{ color: "var(--muted-on-dark)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Your account <strong style={{ color: "var(--text-on-dark)" }}>@{username}</strong> (FID {newFid}) is live on-chain.
            </p>
            <div style={{ background: "var(--bg-dark)", borderRadius: 12, padding: "12px 16px", marginBottom: 24, border: "1px solid var(--border)", textAlign: "left" }}>
              {[
                ["FID minted", status.fid],
                ["Signer registered", status.signer],
                [`@${username} claimed`, status.fname],
              ].map(([label, ok]) => (
                <div key={label as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                  <span style={{ color: "var(--muted-on-dark)" }}>{label as string}</span>
                  <span style={{ color: ok ? "#22c55e" : "#f87171" }}>{ok ? "✓" : "needs retry"}</span>
                </div>
              ))}
            </div>
            {!status.fname && (
              <p style={{ fontSize: 12, color: "#f87171", marginBottom: 16 }}>
                Username claim failed — you can set it later in settings or try again.
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
  );
}