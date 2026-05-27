"use client";

import React, { useState } from "react";
import { useFarcasterWrites } from "@/hooks/useFarcasterWrites";

export default function SignerManager() {
  const { hasActiveSigner, requestSigner } = useFarcasterWrites();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleRequestSigner() {
    setLoading(true);
    try {
      await requestSigner();
      // Privy opens Warpcast approval flow natively; collapse after request initiated
      setExpanded(false);
    } catch (e: any) {
      console.error("Signer request failed:", e);
      alert(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ margin: "16px 0" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: hasActiveSigner ? "rgba(34, 197, 94, 0.1)" : "rgba(59, 130, 246, 0.1)",
          border: `1px solid ${hasActiveSigner ? "rgb(34, 197, 94)" : "rgb(59, 130, 246)"}`,
          color: hasActiveSigner ? "rgb(34, 197, 94)" : "rgb(59, 130, 246)",
          padding: "8px 12px",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        {hasActiveSigner ? "✓ Write Access Approved" : "◉ Grant Write Access"}
      </button>

      {expanded && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            background: "rgba(0, 0, 0, 0.2)",
          }}
        >
          {hasActiveSigner ? (
            <>
              <div style={{ marginBottom: "10px", fontSize: "13px", color: "var(--muted-on-dark)" }}>
                Signer status: <strong style={{ color: "rgb(34, 197, 94)" }}>Approved</strong>
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted-on-dark)" }}>
                You can now post casts. Your access persists on this browser.
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: "10px", fontSize: "13px", color: "var(--muted-on-dark)" }}>
                Grant posting access to your Farcaster account. You'll approve this in Warpcast — it only takes a few seconds.
              </div>
              <button
                onClick={handleRequestSigner}
                disabled={loading}
                style={{
                  background: "rgb(59, 130, 246)",
                  color: "white",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.5 : 1,
                  fontSize: "14px",
                }}
              >
                {loading ? "Opening Warpcast…" : "Enable Posting"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
