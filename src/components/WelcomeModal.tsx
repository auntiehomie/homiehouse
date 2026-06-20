"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { usePrivy } from '@privy-io/react-auth';
import { provisionSignerWithMnemonic } from '@/lib/fc-key-add';

export default function WelcomeModal() {
  const { user } = usePrivy();
  const [show, setShow] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [method, setMethod] = useState<'farcaster' | 'phrase'>('farcaster');
  const [phrase, setPhrase] = useState('');
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleShowModal = (event: any) => {
      const url = event.detail.approvalUrl ?? null;
      setApprovalUrl(url);
      setShow(true);
      setMethod(url ? 'farcaster' : 'phrase');
      setPhrase('');
      setError(null);
    };
    window.addEventListener("showWelcomeModal", handleShowModal);
    return () => window.removeEventListener("showWelcomeModal", handleShowModal);
  }, []);

  function getFid(): number | null {
    const farcasterAccount = user?.linkedAccounts?.find((a: any) => a.type === 'farcaster') as any;
    if (farcasterAccount?.fid) return farcasterAccount.fid;
    try {
      const stored = localStorage.getItem("hh_profile");
      return stored ? JSON.parse(stored)?.fid ?? null : null;
    } catch { return null; }
  }

  const checkApprovalStatus = async () => {
    setChecking(true);
    setError(null);
    try {
      const fid = getFid();
      if (!fid) { setError('Could not find your Farcaster ID.'); return; }

      const key = `signer_${fid}`;
      const stored = localStorage.getItem(key);
      if (!stored) { setError('No signer found. Try refreshing.'); return; }

      const parsed = JSON.parse(stored);
      const signerUuid = parsed.signer_uuid;
      if (!signerUuid) { setError('No signer UUID found.'); return; }

      const res = await fetch(`/api/signer?signer_uuid=${signerUuid}`);
      const data = await res.json();

      if (data.ok && data.status === "approved") {
        if (!parsed.private_key) {
          // Key was lost (old version of app stored without private_key) — clear and restart
          localStorage.removeItem(key);
          setError("Approval confirmed, but the signing key was lost. Creating a new signer — please wait…");
          const newFid = getFid();
          if (newFid) window.dispatchEvent(new CustomEvent('hh:request:signer', { detail: { fid: newFid } }));
          return;
        }
        parsed.status = "approved";
        localStorage.setItem(key, JSON.stringify(parsed));
        window.dispatchEvent(new Event('hh:signer:approved'));
        setShow(false);
        setTimeout(() => window.location.reload(), 300);
      } else {
        setError("Not approved yet — please approve in the Farcaster app first.");
      }
    } catch (e: any) {
      setError(e.message || 'Error checking status');
    } finally {
      setChecking(false);
    }
  };

  const handleProvisionWithPhrase = async () => {
    setError(null);
    setProvisioning(true);
    try {
      const fid = getFid();
      if (!fid) throw new Error('Could not find your Farcaster ID. Please sign in again.');

      const result = await provisionSignerWithMnemonic(fid, phrase);
      setPhrase('');

      // Signer is registered on-chain directly — always approved
      localStorage.setItem(`signer_${fid}`, JSON.stringify({
        signer_uuid: result.signer_uuid ?? null,
        public_key: `0x${result.publicKeyHex}`,
        private_key: result.privateKeyHex,
        status: 'approved',
        signer_approval_url: null,
      }));
      window.dispatchEvent(new Event('hh:signer:approved'));
      setShow(false);
      setTimeout(() => window.location.reload(), 300);
    } catch (e: any) {
      setError(e.message || 'Failed to set up signer');
    } finally {
      setProvisioning(false);
    }
  };

  const handleClose = () => {
    setShow(false);
    setPhrase('');
    setError(null);
    sessionStorage.setItem("signer_approval_skipped", "true");
  };

  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 500 }}>
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Enable Posting
          </h3>
          <p style={{ color: 'var(--muted-on-dark)', marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
            Approve HomieHouse to post on your behalf — a one-time setup.
          </p>

          {/* Tab switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            <button
              onClick={() => { setMethod('farcaster'); setError(null); }}
              style={{
                flex: 1, padding: '8px 0', fontSize: 13, fontWeight: method === 'farcaster' ? 600 : 400,
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: method === 'farcaster' ? '2px solid var(--foreground)' : '2px solid transparent',
                color: method === 'farcaster' ? 'var(--foreground)' : 'var(--muted-on-dark)',
                marginBottom: -1,
              }}
            >
              Farcaster App
            </button>
            <button
              onClick={() => { setMethod('phrase'); setError(null); }}
              style={{
                flex: 1, padding: '8px 0', fontSize: 13, fontWeight: method === 'phrase' ? 600 : 400,
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: method === 'phrase' ? '2px solid var(--foreground)' : '2px solid transparent',
                color: method === 'phrase' ? 'var(--foreground)' : 'var(--muted-on-dark)',
                marginBottom: -1,
              }}
            >
              Recovery Phrase
            </button>
          </div>

          {method === 'farcaster' ? (
            <>
              {approvalUrl && (
                <>
                  <div style={{ background: 'white', padding: 16, borderRadius: 8, display: 'inline-block', marginBottom: 12 }}>
                    <QRCodeSVG value={approvalUrl} size={180} />
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--muted-on-dark)', marginBottom: 12 }}>
                    Scan with your phone or tap below:
                  </p>
                  <a
                    href={approvalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn primary"
                    style={{ display: 'block', textAlign: 'center', marginBottom: 12, padding: 12, width: '100%' }}
                  >
                    Approve in Farcaster →
                  </a>
                </>
              )}
              <button
                className="btn"
                onClick={checkApprovalStatus}
                disabled={checking}
                style={{ width: '100%', padding: 12, marginBottom: 8 }}
              >
                {checking ? "Checking…" : "I've Approved — Continue"}
              </button>
            </>
          ) : (
            <>
              <div style={{
                background: 'rgba(255,200,0,0.08)', border: '1px solid rgba(255,200,0,0.25)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16, textAlign: 'left',
              }}>
                <p style={{ fontSize: 12, color: '#d4aa00', margin: 0, lineHeight: 1.5 }}>
                  ⚠️ Your recovery phrase never leaves your device. It is used only to sign the key registration and is never stored or sent to any server.
                </p>
              </div>
              <textarea
                value={phrase}
                onChange={e => { setPhrase(e.target.value); setError(null); }}
                placeholder="Enter your 12 or 24-word Farcaster recovery phrase…"
                rows={4}
                disabled={provisioning}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--foreground)', fontSize: 14, resize: 'vertical',
                  fontFamily: 'monospace', marginBottom: 12, boxSizing: 'border-box',
                }}
              />
              <button
                className="btn primary"
                onClick={handleProvisionWithPhrase}
                disabled={provisioning || !phrase.trim()}
                style={{ width: '100%', padding: 12, marginBottom: 8 }}
              >
                {provisioning ? "Connecting…" : "Connect Instantly"}
              </button>
            </>
          )}

          {error && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6, fontSize: 13, color: '#f87171', textAlign: 'left' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--muted-on-dark)', cursor: 'pointer', fontSize: 13, padding: 8, marginTop: 8, textDecoration: 'underline' }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
