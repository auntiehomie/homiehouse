"use client";

import React, { useState, useEffect } from "react";

export default function SignerManager() {
  const [profile, setProfile] = useState<any>(null);
  const [signerUuid, setSignerUuid] = useState<string | null>(null);
  const [signerStatus, setSignerStatus] = useState<string | null>(null);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Load profile and signer from localStorage
  useEffect(() => {
    const storedProfile = localStorage.getItem("hh_profile");
    if (storedProfile) {
      try {
        const parsed = JSON.parse(storedProfile);
        setProfile(parsed);
        
        if (parsed?.fid) {
          const key = `signer_${parsed.fid}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const signerData = JSON.parse(stored);
              setSignerUuid(signerData.signer_uuid);
              setSignerStatus(signerData.status);
            } catch (e) {
              console.error("Failed to parse stored signer", e);
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse stored profile", e);
      }
    }
  }, []);

  async function createSigner() {
    if (!profile?.fid) {
      alert("Sign in first.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/signer", { method: "POST" });
      const data = await res.json();

      if (data.ok && data.signer_uuid) {
        const uuid = data.signer_uuid;
        setSignerUuid(uuid);
        setSignerStatus(data.status);
        setApprovalUrl(data.signer_approval_url);

        // Store in localStorage
        const key = `signer_${profile.fid}`;
        localStorage.setItem(key, JSON.stringify({ signer_uuid: uuid, status: data.status }));

        console.log("Signer created and stored:", uuid, data.status);
      } else {
        alert(`Failed: ${data.error || "unknown error"}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus() {
    if (!signerUuid) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/signer?signer_uuid=${encodeURIComponent(signerUuid)}`);
      const data = await res.json();

      if (data.ok) {
        const newStatus = data.status;
        setSignerStatus(newStatus);

        // Update localStorage
        if (profile?.fid) {
          const key = `signer_${profile.fid}`;
          localStorage.setItem(key, JSON.stringify({ signer_uuid: signerUuid, status: newStatus }));
        }

        console.log("Signer status updated:", newStatus);

        if (newStatus === "approved") {
          setExpanded(false); // Auto-collapse when approved
        }
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (!profile) {
    return null;
  }

  const isApproved = signerStatus === "approved";
  const isPending = signerStatus === "pending_approval";

  return (
    <div style={{ margin: "16px 0" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: isApproved ? "rgba(34, 197, 94, 0.1)" : "rgba(59, 130, 246, 0.1)",
          border: `1px solid ${isApproved ? "rgb(34, 197, 94)" : "rgb(59, 130, 246)"}`,
          color: isApproved ? "rgb(34, 197, 94)" : "rgb(59, 130, 246)",
          padding: "8px 12px",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        {isApproved ? "✓ Write Access Approved" : "◉ Grant Write Access"}
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
          {!signerUuid ? (
            <>
              <div style={{ marginBottom: "10px", fontSize: "13px", color: "var(--muted-on-dark)" }}>
                Create a signer to post casts. This grants temporary write access to your account.
              </div>
              <button
                onClick={createSigner}
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
                {loading ? "Creating…" : "Create Signer"}
              </button>
            </>
          ) : isPending ? (
            <>
              <div style={{ marginBottom: "10px", fontSize: "13px", color: "var(--muted-on-dark)" }}>
                Signer created. Click the link below to approve it with your Farcaster wallet.
              </div>
              {approvalUrl && (
                <a
                  href={approvalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    background: "rgb(251, 146, 60)",
                    color: "white",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    textDecoration: "none",
                    marginBottom: "10px",
                    fontSize: "14px",
                  }}
                >
                  Approve Signer →
                </a>
              )}
              <div style={{ marginTop: "10px" }}>
                <button
                  onClick={checkStatus}
                  disabled={loading}
                  style={{
                    background: "transparent",
                    border: "1px solid rgb(59, 130, 246)",
                    color: "rgb(59, 130, 246)",
                    padding: "6px 10px",
                    borderRadius: "4px",
                    cursor: loading ? "not-allowed" : "pointer",
                    fontSize: "13px",
                  }}
                >
                  {loading ? "Checking…" : "Check Status"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: "10px", fontSize: "13px", color: "var(--muted-on-dark)" }}>
                Signer status: <strong style={{ color: "rgb(34, 197, 94)" }}>Approved</strong>
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted-on-dark)" }}>
                You can now post casts. Your access persists on this browser.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
