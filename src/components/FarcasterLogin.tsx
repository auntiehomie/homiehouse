'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { createPortal } from 'react-dom';
import { useAccount, useConnect, useConnectors, useDisconnect, useSignMessage } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { createMessage, encodeToken } from '@farcasterorg/quick-auth/token';
import { useSessionAuth } from '@/hooks/useSessionAuth';
import { subscribePairingUri } from '@/lib/wallet-pairing';

interface LinkedAccount {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  link: { method: string; address?: string };
}

interface FarcasterLoginProps {
  onLogin?: () => void;
  modal?: boolean;
  onDismiss?: () => void;
  requestPostingOnLogin?: boolean;
}

export default function FarcasterLogin({ onLogin, modal = false, onDismiss, requestPostingOnLogin = true }: FarcasterLoginProps) {
  const { address, isConnected } = useAccount();
  const { connectAsync, isPending: isConnecting } = useConnect();
  const connectors = useConnectors();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();
  const { disconnectAsync } = useDisconnect();
  const { createSessionFromProtocolToken } = useSessionAuth();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [signingFid, setSigningFid] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const [pairingPending, setPairingPending] = useState(false);
  const pairingBusy = useRef(false);
  const pairingCleanup = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => pairingCleanup.current?.(), []);
  const walletConnectConnector = connectors.find((connector) => connector.id === 'walletConnect');

  async function connectWithWalletConnectQr() {
    if (pairingBusy.current) return;
    if (!walletConnectConnector) {
      setError('WalletConnect QR is unavailable. Please use a browser wallet or try again later.');
      return;
    }
    setError(null);
    setPairingUri(null);
    pairingBusy.current = true;
    setPairingPending(true);
    let removeUriListener: (() => void) | undefined;
    try {
      // This connector deliberately has showQrModal:false. Subscribe before
      // connecting and render the pairing URI here rather than loading AppKit.
      const provider = await walletConnectConnector.getProvider();
      removeUriListener = subscribePairingUri(provider, setPairingUri);
      pairingCleanup.current = removeUriListener;
      await connectAsync({ connector: walletConnectConnector });
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || 'Could not start WalletConnect. Please try again.');
    } finally {
      removeUriListener?.();
      pairingBusy.current = false;
      pairingCleanup.current = undefined;
      setPairingPending(false);
      setPairingUri(null);
    }
  }

  const loadAccounts = useCallback(async () => {
    if (!address) {
      setAccounts([]);
      return;
    }
    setLoadingAccounts(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/linked-accounts?address=${encodeURIComponent(address)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.status === 404) {
        setAccounts([]);
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Could not look up accounts on Hypersnap.');
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    } catch (err: any) {
      setError(err?.message || 'Could not look up accounts on Hypersnap.');
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }, [address]);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);

  async function signInAs(account: LinkedAccount) {
    if (!address) {
      openConnectModal?.();
      return;
    }
    setError(null);
    setSigningFid(account.fid);
    try {
      const domain = window.location.host;
      const message = createMessage({
        domain,
        uri: `${window.location.origin}/`,
        address: address as `0x${string}`,
        chainId: 1,
        fid: account.fid,
        expiresIn: 15 * 60,
      });
      const signature = await signMessageAsync({ message });
      const protocolToken = encodeToken({ message, signature });
      const result = await createSessionFromProtocolToken(protocolToken);
      if (!result.ok) throw new Error(result.error);

      const profileResponse = await fetch(`/api/profile?fid=${account.fid}`, { cache: 'no-store' });
      const profileData = profileResponse.ok ? await profileResponse.json() : {};
      localStorage.setItem('hh_profile', JSON.stringify({
        fid: account.fid,
        username: profileData.username || account.username || '',
        displayName: profileData.display_name || account.displayName || account.username || '',
        pfpUrl: profileData.pfp_url || account.pfpUrl || '',
        bio: profileData.profile?.bio?.text || '',
        signer_uuid: '',
        verified_addresses: profileData.verified_addresses || { eth_addresses: [] },
        auth_method: 'hypersnap-wallet',
      }));
      window.dispatchEvent(new Event('hh:auth:changed'));
      if (requestPostingOnLogin) window.dispatchEvent(new CustomEvent('hh:request:signer', { detail: { fid: account.fid } }));
      onLogin?.();
    } catch (err: any) {
      setError(err?.message || 'Wallet sign-in failed. Check that this wallet is linked to the selected FID.');
    } finally {
      setSigningFid(null);
    }
  }

  const content = (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 42, marginBottom: 12 }}>🟣</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: 'var(--text-on-dark)' }}>
        Sign in with your wallet
      </h2>
      <p style={{ color: 'var(--muted-on-dark)', fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
        Hypersnap will find Farcaster accounts linked to your wallet. Sign a short-lived login message to prove control—no Farcaster app approval or recovery phrase. On a computer, connect a browser wallet or pair a phone wallet by QR code.
      </p>

      {!isConnected ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <button className="btn primary" disabled={isConnecting || pairingPending} onClick={() => openConnectModal?.()} style={{ width: '100%', padding: 13 }}>
            Connect browser wallet
          </button>
          {walletConnectConnector && <button className="btn" onClick={() => void connectWithWalletConnectQr()} disabled={isConnecting || pairingPending} style={{ width: '100%', padding: 13 }}>
            {isConnecting || pairingPending ? 'Waiting for wallet…' : 'Connect phone wallet with QR'}
          </button>}
          {pairingUri && (
            <div role="status" aria-label="WalletConnect pairing QR code">
              <div style={{ background: '#fff', padding: 16, borderRadius: 12, width: 'fit-content', margin: '0 auto' }}>
                <QRCodeSVG value={pairingUri} size={220} marginSize={2} style={{ display: 'block', maxWidth: '100%', height: 'auto' }} />
              </div>
              <p style={{ color: 'var(--muted-on-dark)', fontSize: 13 }}>Open your phone wallet’s scanner, scan this code, then approve the connection.</p>
            </div>
          )}
          <small style={{ color: 'var(--muted-on-dark)', lineHeight: 1.5 }}>
            Scan the QR code with Rainbow or another wallet that supports WalletConnect.
          </small>
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--muted-on-dark)', fontSize: 12, margin: '0 0 14px', wordBreak: 'break-all' }}>
            Connected: {address}
          </p>
          <button
            className="btn"
            onClick={async () => {
              await disconnectAsync();
              window.setTimeout(() => openConnectModal?.(), 0);
            }}
            style={{ width: '100%', marginBottom: 12, padding: 10 }}
          >
            Change wallet
          </button>
          {loadingAccounts && <p role="status" style={{ color: 'var(--muted-on-dark)', fontSize: 13 }}>Finding linked accounts on Hypersnap…</p>}
          {!loadingAccounts && accounts.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {accounts.map((account) => (
                <button
                  key={account.fid}
                  onClick={() => void signInAs(account)}
                  disabled={signingFid !== null}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'var(--text-on-dark)', cursor: 'pointer' }}
                >
                  {account.pfpUrl ? <img src={account.pfpUrl} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border)', display: 'grid', placeItems: 'center' }}>@</span>}
                  <span style={{ flex: 1 }}>
                    <strong style={{ display: 'block' }}>{account.displayName || account.username || `FID ${account.fid}`}</strong>
                    <small style={{ color: 'var(--muted-on-dark)' }}>@{account.username || `FID ${account.fid}`} · {account.link.method}</small>
                  </span>
                  <span>{signingFid === account.fid ? 'Signing…' : 'Sign in →'}</span>
                </button>
              ))}
            </div>
          )}
          {!loadingAccounts && accounts.length === 0 && !error && (
            <p style={{ color: 'var(--muted-on-dark)', fontSize: 13 }}>
              No existing FID is linked to this wallet. You can create an account with this wallet.
            </p>
          )}
          {!loadingAccounts && accounts.length === 0 && (
            <button
              onClick={() => { window.dispatchEvent(new Event('hh:need:farcaster-account')); onDismiss?.(); }}
              className="btn primary"
              style={{ width: '100%', padding: 13, marginTop: 8 }}
            >
              Create account with this wallet
            </button>
          )}
          <button className="btn" onClick={() => void loadAccounts()} disabled={loadingAccounts} style={{ width: '100%', marginTop: 8, padding: 10 }}>
            Refresh linked accounts
          </button>
        </>
      )}

      {error && <p role="alert" style={{ color: '#f87171', fontSize: 13, margin: '12px 0 0', textAlign: 'left' }}>{error}</p>}
      <p style={{ color: 'var(--muted-on-dark)', fontSize: 11, marginTop: 14 }}>
        A successful login grants a read session. Posting permissions are a separate, optional Hypersnap signer approval.
      </p>
    </div>
  );

  if (!modal) {
    return <div style={{ maxWidth: 400, width: '100%', margin: '40px auto', padding: '32px 28px', background: 'var(--surface)', borderRadius: 24, border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>{content}</div>;
  }

  // Escape transformed and backdrop-filtered ancestors (hero CTA and sticky header).
  // Those ancestors otherwise become the containing block for a fixed overlay.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-overlay wallet-login-modal-overlay" onClick={onDismiss}>
      <div className="modal wallet-login-modal" role="dialog" aria-modal="true" aria-label="Sign in with your wallet" onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 8px 0' }}>
          <button type="button" className="btn" aria-label="Close sign-in" onClick={onDismiss}>✕</button>
        </div>
        <div style={{ padding: '0 24px 28px' }}>{content}</div>
      </div>
    </div>,
    document.body,
  );
}
