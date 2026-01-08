"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';

export default function WelcomeModal() {
  const [show, setShow] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const handleShowModal = (event: any) => {
      setApprovalUrl(event.detail.approvalUrl);
      setShow(true);
    };

    window.addEventListener("showWelcomeModal", handleShowModal);
    return () => window.removeEventListener("showWelcomeModal", handleShowModal);
  }, []);

  const checkApprovalStatus = async () => {
    setChecking(true);
    try {
      const storedProfile = localStorage.getItem("hh_profile");
      if (!storedProfile) return;
      
      const profile = JSON.parse(storedProfile);
      const fid = profile?.fid;
      if (!fid) return;
      
      const key = `signer_${fid}`;
      const stored = localStorage.getItem(key);
      if (!stored) return;
      
      const parsed = JSON.parse(stored);
      const signerUuid = parsed.signer_uuid;
      if (!signerUuid) return;

      const res = await fetch(`/api/signer?signer_uuid=${signerUuid}`);
      const data = await res.json();

      if (data.ok && data.status === "approved") {
        // Update localStorage
        parsed.status = "approved";
        localStorage.setItem(key, JSON.stringify(parsed));
        
        // Close modal and reload page to refresh UI
        setShow(false);
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        alert("Not approved yet. Please approve in Warpcast first.");
      }
    } catch (error) {
      console.error("Error checking approval:", error);
    } finally {
      setChecking(false);
    }
  };

  const handleSkip = () => {
    setShow(false);
    sessionStorage.setItem("signer_approval_skipped", "true");
  };

  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
          <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
            Welcome to HomieHouse!
          </h3>
          <p style={{ color: 'var(--muted-on-dark)', marginBottom: 24, lineHeight: 1.6 }}>
            To like, recast, and post content, you need to approve posting permissions in Warpcast. 
            <strong> This is a one-time setup that takes 5 seconds.</strong>
          </p>
          
          {approvalUrl && (
            <>
              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', display: 'inline-block', marginBottom: '12px' }}>
                <QRCodeSVG value={approvalUrl} size={200} />
              </div>
              <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', marginBottom: 12 }}>
                Scan this QR code or click below to approve:
              </p>
              <a 
                href={approvalUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn primary" 
                style={{ display: 'block', textAlign: 'center', marginBottom: 12, padding: '12px', width: '100%' }}
              >
                Approve in Warpcast →
              </a>
            </>
          )}
          
          <button 
            className="btn" 
            onClick={checkApprovalStatus}
            disabled={checking}
            style={{ width: '100%', padding: '12px', marginBottom: '8px' }}
          >
            {checking ? "Checking..." : "I've Approved - Continue"}
          </button>
          
          <button 
            onClick={handleSkip}
            style={{ 
              background: 'transparent',
              border: 'none',
              color: 'var(--muted-on-dark)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '8px',
              textDecoration: 'underline'
            }}
          >
            Skip for now (you can approve later)
          </button>
        </div>
      </div>
    </div>
  );
}
