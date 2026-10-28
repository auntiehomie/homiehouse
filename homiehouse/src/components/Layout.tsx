import { Outlet } from "react-router-dom";
import Nav from "./Nav";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { useEffect, useState } from "react";
import { getCapabilities, getQuickAuthToken, quickAuthFetch } from "../lib/farcaster";

export default function Layout() {
  return (
    <div className="app-root" style={{ fontFamily: "system-ui, sans-serif" }}>
      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>HomieHouse</h1>
            <Nav />
          </div>
          <div className="header-actions">
            <ConnectMenu />
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function ConnectMenu() {
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const [supportsWallet, setSupportsWallet] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const caps = await getCapabilities();
        if (mounted) setSupportsWallet(caps.includes("wallet.getEthereumProvider"));
      } catch (e) {
        if (mounted) setSupportsWallet(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (isConnected) {
    return (
      <div className="connect-info">
        <div>Connected: {address}</div>
        <SignButton />
      </div>
    );
  }

  const hasConnector = Array.isArray(connectors) && connectors.length > 0;

  return (
    <div className="connect-container">
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          if (!hasConnector) return;
          connect({ connector: connectors[0] });
        }}
        disabled={!hasConnector}
        title={hasConnector ? "Connect wallet" : "No connector available in this environment"}
      >
        Connect
      </button>
      {!hasConnector && <div className="muted" style={{ marginTop: 6 }}>No connectors available here.</div>}
      {supportsWallet === false && (
        <div className="muted" style={{ marginTop: 6 }}>Host does not expose a wallet provider.</div>
      )}
    </div>
  );
}

function SignButton() {
  const { signMessage, isPending, data, error } = useSignMessage();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signedInFid, setSignedInFid] = useState<number | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);

  async function handleQuickAuth() {
    setIsSigningIn(true);
    setSignInError(null);
    try {
      const token = await getQuickAuthToken();
      if (!token) throw new Error('Quick Auth not available');
      // send token to example backend session endpoint
      const res = await quickAuthFetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'session endpoint error');
      }
      const json = await res.json();
      setSignedInFid(json.fid ?? null);
    } catch (err: any) {
      setSignInError(err?.message ?? String(err));
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn primary" onClick={() => signMessage({ message: 'homiehouse' })} disabled={isPending}>
          {isPending ? 'Signing...' : 'Sign message'}
        </button>
        <button type="button" className="btn" onClick={handleQuickAuth} disabled={isSigningIn}>
          {isSigningIn ? 'Signing in...' : 'Sign In (Quick Auth)'}
        </button>
      </div>
      {data && <div>Signature: {String(data)}</div>}
      {error && <div>Error: {error.message}</div>}
      {signedInFid && <div>Signed in FID: {signedInFid}</div>}
      {signInError && <div className="muted">Sign-in error: {signInError}</div>}
    </div>
  );
}
