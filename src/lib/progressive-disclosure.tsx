"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import React from "react";

export type UserExpertise = "beginner" | "intermediate" | "advanced";

interface ProgressiveDisclosureState {
  expertise: UserExpertise;
  setExpertise: (level: UserExpertise) => void;

  // Feature visibility
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;

  // Tooltips
  tooltipOpen: string | null;
  openTooltip: (key: string) => void;
  closeTooltip: () => void;

  // Tour
  tourStep: number;
  tourActive: boolean;
  startTour: () => void;
  nextTourStep: () => void;
  endTour: () => void;

  // Dismissed hints
  dismissedHints: string[];
  dismissHint: (key: string) => void;
  resetHints: () => void;
}

// Crypto terms dictionary for tooltips
export const CRYPTO_TERMS: Record<string, { short: string; long: string; category: string }> = {
  fid: {
    short: "Your unique Farcaster ID number (like a username but permanent)",
    long: "FID = Farcaster ID. It's a unique number minted on Optimism that permanently identifies your account on the Farcaster protocol. Unlike a username, it can never be changed or taken away.",
    category: "identity",
  },
  signer: {
    short: "A key that lets apps post on your behalf",
    long: "A signer is an Ed25519 keypair registered to your FID. It authorizes an app (like HomieHouse) to sign and broadcast messages for you — cast, like, recast, follow — without your custody wallet's private key ever leaving your control.",
    category: "auth",
  },
  custody: {
    short: "Your main wallet that owns the FID",
    long: "The custody address is the Ethereum/Optimism wallet that owns your FID. It's the 'root of trust' — only this wallet can add/remove signers, recover the account, or change the username. HomieHouse never asks for this private key.",
    category: "auth",
  },
  "eip-712": {
    short: "Standard for human-readable signature prompts",
    long: "EIP-712 makes wallet signature requests show structured, readable data (like 'Register FID 12345') instead of a raw hex string. This prevents phishing — you can actually verify what you're signing.",
    category: "security",
  },
  "recovery-phrase": {
    short: "12-24 word backup for your wallet",
    long: "Your recovery phrase (seed phrase) generates all your wallet's private keys. Anyone with this phrase has full control of your funds and Farcaster account. Never share it. HomieHouse only uses it locally to derive a signer key — it never leaves your browser.",
    category: "security",
  },
  optimism: {
    short: "Low-cost Ethereum L2 where FIDs live",
    long: "Optimism is an Ethereum Layer 2 rollup. Farcaster stores FIDs, signers, and usernames on Optimism because it's fast, cheap (~$0.01/tx), and inherits Ethereum's security. Your FID is an NFT on Optimism.",
    category: "protocol",
  },
  "erc-20": {
    short: "Standard fungible token on Ethereum/Optimism",
    long: "ERC-20 is the standard interface for fungible tokens. HH2 is an ERC-20 token on Base (another L2). It can be transferred, traded, or used in apps just like USDC or OP.",
    category: "tokens",
  },
  frame: {
    short: "Interactive mini-app inside a Farcaster cast",
    long: "Frames (now called 'Mini Apps') turn a cast into an interactive experience — buttons, inputs, images that update in real-time. They run in an iframe and communicate with the parent via the Farcaster Frame protocol.",
    category: "protocol",
  },
  cast: {
    short: "A post on Farcaster (like a tweet)",
    long: "A cast is the core unit of content on Farcaster. It has text, optional embeds (images, links, frames), and metadata. Casts are signed by a signer key and distributed via the Farcaster peer-to-peer network.",
    category: "protocol",
  },
  recast: {
    short: "Share someone's cast to your followers",
    long: "A recast amplifies another user's cast to your followers — similar to a retweet. It preserves the original author and creates a verifiable link back to the source cast.",
    category: "protocol",
  },
  channel: {
    short: "Topic-based feed (like a subreddit)",
    long: "Channels are parent casts that define a topic. Users 'follow' a channel to see its casts in their feed. Channel moderators can curate, and anyone can post to a channel by mentioning it. No single entity owns a channel.",
    category: "protocol",
  },
  warpcast: {
    short: "The flagship Farcaster client (mobile/web app)",
    long: "Warpcast is the main app built by the Farcaster team. It's a full-featured client for reading/writing casts, managing your account, and discovering content. HomieHouse is an alternative client with AI learning features.",
    category: "ecosystem",
  },
  "hh2": {
    short: "HomieHouse's reward token on Base",
    long: "HH2 is an ERC-20 token on Base earned by completing learning modules. It's not an investment — it's a gamification layer. You can claim it to your wallet, and future features may let you spend it on cosmetics, boosts, or governance.",
    category: "app",
  },
  "learning-streak": {
    short: "Consecutive days of completing lessons",
    long: "Complete at least one lesson per day to maintain your streak. Missing a day resets it (unless you have a freeze). Streaks unlock bonus HH2 and appear on the weekly leaderboard if you opt in.",
    category: "app",
  },
  "ask-homie": {
    short: "AI assistant for Web3 questions",
    long: "Ask Homie is an AI agent that answers Web3 questions, summarizes articles, and explains concepts at your expertise level. It uses a free-tier-first AI provider chain and respects your ELI5/Simple Language settings.",
    category: "app",
  },
  hypersnap: {
    short: "Farcaster data indexer API",
    long: "Hypersnap is the backend API HomieHouse uses to query Farcaster data (casts, profiles, channels, follows). It indexes the Farcaster network and provides GraphQL/REST endpoints — faster and more reliable than running your own node.",
    category: "infrastructure",
  },
  "gas-fee": {
    short: "Transaction cost paid in ETH",
    long: "Every on-chain action (minting FID, registering signer, claiming username) costs gas. HomieHouse pays gas for your account creation via a server wallet — you don't need ETH to get started.",
    category: "protocol",
  },
  "base-chain": {
    short: "Coinbase's Ethereum L2 (where HH2 lives)",
    long: "Base is an Optimism-stack L2 incubated by Coinbase. It's low-cost, fast, and EVM-compatible. HH2 is deployed on Base because it's accessible to mainstream users via Coinbase Wallet.",
    category: "protocol",
  },
  "depin": {
    short: "Decentralized Physical Infrastructure Networks",
    long: "DePIN projects use token incentives to coordinate real-world infrastructure (WiFi, sensors, compute, maps). Examples: Helium (wireless), Hivemapper (maps), Render (GPU). Not a Farcaster concept — general Web3.",
    category: "web3",
  },
  "dao": {
    short: "Decentralized Autonomous Organization",
    long: "A DAO is an org governed by token holders voting on-chain. No central leadership — rules encoded in smart contracts. Farcaster has DAO-adjacent features (channels with moderation, token-gated access).",
    category: "web3",
  },
  "defi": {
    short: "Decentralized Finance",
    long: "DeFi = financial services (lending, trading, yield) built on smart contracts, no banks. Key primitives: Aave (lend/borrow), Uniswap (swap), Curve (stable swaps). HomieHouse teaches DeFi in the Financial track.",
    category: "web3",
  },
  "nft": {
    short: "Non-Fungible Token (unique digital item)",
    long: "NFTs represent unique ownership of digital items (art, tickets, domains, FIDs). ERC-721 is the standard. Your FID is technically an NFT on Optimism — unique, non-fungible, and transferable.",
    category: "web3",
  },
};

// Categories for grouping tooltips
export const TOOLTIP_CATEGORIES = [
  { id: "identity", label: "Identity & Accounts", emoji: "🪪" },
  { id: "auth", label: "Authentication & Keys", emoji: "🔐" },
  { id: "security", label: "Security", emoji: "🛡️" },
  { id: "protocol", label: "Farcaster Protocol", emoji: "🟣" },
  { id: "tokens", label: "Tokens & Economics", emoji: "🪙" },
  { id: "app", label: "HomieHouse Features", emoji: "🏠" },
  { id: "infrastructure", label: "Infrastructure", emoji: "⚙️" },
  { id: "ecosystem", label: "Ecosystem", emoji: "🌐" },
  { id: "web3", label: "General Web3", emoji: "🌍" },
];

export const useProgressiveDisclosure = create<ProgressiveDisclosureState>()(
  persist(
    (set, get) => ({
      expertise: "beginner",
      setExpertise: (level) => set({ expertise: level }),

      showAdvanced: false,
      setShowAdvanced: (v) => set({ showAdvanced: v }),

      tooltipOpen: null,
      openTooltip: (key) => set({ tooltipOpen: key }),
      closeTooltip: () => set({ tooltipOpen: null }),

      tourStep: 0,
      tourActive: false,
      startTour: () => set({ tourActive: true, tourStep: 0 }),
      nextTourStep: () => set((s) => ({ tourStep: s.tourStep + 1 })),
      endTour: () => set({ tourActive: false, tourStep: 0 }),

      dismissedHints: [],
      dismissHint: (key) => set((s) => ({ dismissedHints: [...s.dismissedHints, key] })),
      resetHints: () => set({ dismissedHints: [] }),
    }),
    { name: "hh-progressive-disclosure" }
  )
);

// Helper hook for tooltip
export function useTooltip(termKey: string) {
  const { tooltipOpen, openTooltip, closeTooltip, expertise } = useProgressiveDisclosure();
  const isOpen = tooltipOpen === termKey;
  const term = CRYPTO_TERMS[termKey];
  return {
    term,
    isOpen,
    open: () => openTooltip(termKey),
    close: closeTooltip,
    shouldShow: !!term && expertise !== "advanced",
  };
}

// Helper for conditional rendering based on expertise
export function useExpertise() {
  const { expertise, showAdvanced, setShowAdvanced } = useProgressiveDisclosure();
  return {
    expertise,
    isBeginner: expertise === "beginner",
    isIntermediate: expertise === "intermediate",
    isAdvanced: expertise === "advanced",
    showAdvanced,
    setShowAdvanced,
  };
}

// Component for tooltip trigger (info icon)
export function TooltipTrigger({ termKey, children, className = "" }: {
  termKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { term, isOpen, open, close, shouldShow } = useTooltip(termKey);
  if (!shouldShow || !term) return <React.Fragment>{children}</React.Fragment>;

  return (
    <span style={{ position: "relative", display: "inline-flex" }} className={className}>
      {children}
      <button
        onClick={isOpen ? close : open}
        onMouseEnter={open}
        onMouseLeave={close}
        style={{
          marginLeft: 4, padding: 2, border: "none", background: "none",
          cursor: "help", color: "var(--muted-on-dark)", fontSize: 12,
          lineHeight: 1, display: "flex", alignItems: "center",
        }}
        aria-label={`Explain ${termKey}`}
      >
        ⓘ
      </button>
      {isOpen && (
        <TooltipContent term={term} onClose={close} />
      )}
    </span>
  );
}

function TooltipContent({ term, onClose }: { term: typeof CRYPTO_TERMS[string]; onClose: () => void }) {
  return (
    <div
      style={{
        position: "absolute", bottom: "calc(100% + 8px)", left: 0,
        maxWidth: 320, zIndex: 1000,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "12px 14px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        fontSize: 13, lineHeight: 1.55, color: "var(--text-on-dark)",
      }}
      onMouseEnter={() => {}}
      onMouseLeave={onClose}
    >
      <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--accent)" }}>{term.short}</p>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted-on-dark)" }}>{term.long}</p>
    </div>
  );
}

// Progressive feature wrapper
export function ProgressiveFeature({ children, minExpertise = "intermediate", fallback = null }: {
  children: React.ReactNode;
  minExpertise?: UserExpertise;
  fallback?: React.ReactNode;
}) {
  const { expertise, showAdvanced } = useExpertise();
  const levels: UserExpertise[] = ["beginner", "intermediate", "advanced"];
  const userLevel = levels.indexOf(expertise);
  const requiredLevel = levels.indexOf(minExpertise);

  if (showAdvanced || userLevel >= requiredLevel) return <>{children}</>;
  return <>{fallback}</>;
}

// Beginner mode badge
export function BeginnerModeBadge() {
  const { expertise, setExpertise, showAdvanced, setShowAdvanced } = useProgressiveDisclosure();
  const isBeginner = expertise === "beginner";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <select
        value={expertise}
        onChange={(e) => setExpertise(e.target.value as UserExpertise)}
        style={{
          padding: "6px 10px", borderRadius: 8, fontSize: 12,
          background: "var(--surface)", border: "1px solid var(--border)",
          color: "var(--text-on-dark)", cursor: "pointer",
        }}
      >
        <option value="beginner">🌱 Beginner</option>
        <option value="intermediate">🔥 Intermediate</option>
        <option value="advanced">⚡ Advanced</option>
      </select>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted-on-dark)", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={showAdvanced}
          onChange={(e) => setShowAdvanced(e.target.checked)}
          style={{ width: 14, height: 14, accentColor: "var(--accent)" }}
        />
        Show advanced features
      </label>
      {isBeginner && (
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
          Beginner mode on
        </span>
      )}
    </div>
  );
}