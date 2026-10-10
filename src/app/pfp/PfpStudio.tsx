'use client';

import { useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useReadContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseEther } from 'viem';

const CONTRACT_ABI = [
  { type: 'function', name: 'MAX_SUPPLY', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalMinted', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'freeMintClaimed', stateMutability: 'view', inputs: [{ name: 'wallet', type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'mint', stateMutability: 'payable', inputs: [{ name: 'metadataURI', type: 'string' }], outputs: [{ type: 'uint256' }] },
] as const;

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HOMIEFY_PFP_CONTRACT_ADDRESS as `0x${string}` | undefined;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const STYLES = [
  { id: 'campus', name: 'Campus Classic', detail: 'Bright, welcoming, and full of personality.' },
  { id: 'lounge', name: 'Creator Lounge', detail: 'Expressive fashion and creative community energy.' },
  { id: 'night', name: 'Night Study', detail: 'Indigo, purple, and green under the campus lights.' },
  { id: 'courtyard', name: 'Courtyard', detail: 'A relaxed portrait in a sunlit digital campus.' },
] as const;

type Platform = 'farcaster' | 'x';

export function PfpStudio({ miniApp = false, initialUsername = '', initialPlatform = 'farcaster' }: {
  miniApp?: boolean;
  initialUsername?: string;
  initialPlatform?: Platform;
}) {
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const [username, setUsername] = useState(initialUsername);
  const [displayName, setDisplayName] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [upload, setUpload] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [style, setStyle] = useState<string>('campus');
  const [consent, setConsent] = useState(false);
  const [imageBase64, setImageBase64] = useState('');
  const [busy, setBusy] = useState<'lookup' | 'generate' | 'mint' | ''>('');
  const [message, setMessage] = useState('');
  const [fid, setFid] = useState<number | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash, chainId: base.id });

  const addressReady = CONTRACT_ADDRESS && CONTRACT_ADDRESS !== ZERO_ADDRESS;
  const contractAddress = addressReady ? CONTRACT_ADDRESS : ZERO_ADDRESS;

  const total = useReadContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'totalMinted',
    chainId: base.id,
    query: { enabled: Boolean(addressReady) },
  });
  const maxSupply = useReadContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'MAX_SUPPLY',
    chainId: base.id,
    query: { enabled: Boolean(addressReady) },
  });
  const freeClaimed = useReadContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'freeMintClaimed',
    args: [address || ZERO_ADDRESS],
    chainId: base.id,
    query: { enabled: Boolean(addressReady && address) },
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('hh_profile');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Number(parsed?.fid) > 0) setFid(Number(parsed.fid));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!upload) {
      setUploadPreview('');
      return;
    }
    const url = URL.createObjectURL(upload);
    setUploadPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [upload]);

  const previewUrl = useMemo(() => imageBase64 ? `data:image/png;base64,${imageBase64}` : '', [imageBase64]);
  const soldOut = maxSupply.data !== undefined && total.data !== undefined && total.data >= maxSupply.data;
  const isFree = freeClaimed.data === false;
  const totalLabel = total.data !== undefined && maxSupply.data !== undefined
    ? `${total.data.toString()} / ${maxSupply.data.toString()} portraits minted`
    : '10,000 portraits total';

  async function lookupProfile() {
    if (!username.trim()) {
      setMessage('Enter a Farcaster or X username first.');
      return;
    }
    setBusy('lookup');
    setMessage('');
    setImageBase64('');
    try {
      const response = await fetch(`/api/pfp/profile?platform=${platform}&username=${encodeURIComponent(username.trim().replace(/^@/, ''))}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Profile lookup failed.');
      setDisplayName(data.displayName || data.username || username);
      setProfileImageUrl(data.profileImageUrl);
      setUpload(null);
      setMessage(`Found @${data.username}. Check the picture before generating.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load that profile.');
    } finally {
      setBusy('');
    }
  }

  async function generate() {
    if (!consent) {
      setMessage('Confirm that you own this photo or have permission to use it.');
      return;
    }
    if (!upload && !profileImageUrl) {
      setMessage('Look up a profile or upload a photo first.');
      return;
    }
    setBusy('generate');
    setMessage('');
    setImageBase64('');
    try {
      const form = new FormData();
      if (upload) form.append('image', upload);
      else form.append('imageUrl', profileImageUrl);
      form.append('style', style);
      form.append('consent', 'true');
      const response = await fetch('/api/pfp/generate', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Generation failed.');
      setImageBase64(data.imageBase64);
      setMessage('Your Homiefy portrait is ready. It is not stored on IPFS unless you mint it.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Image generation failed.');
    } finally {
      setBusy('');
    }
  }

  async function mint() {
    if (!imageBase64 || !address) {
      setMessage('Connect a wallet and generate a portrait first.');
      return;
    }
    if (!addressReady) {
      setMessage('Minting is not live yet. The Homiefy contract address has not been configured.');
      return;
    }
    if (soldOut) {
      setMessage('The Homiefy collection has reached its 10,000 portrait cap.');
      return;
    }
    if (freeClaimed.data === undefined) {
      setMessage('Checking your free mint status. Try again in a moment.');
      return;
    }
    setBusy('mint');
    setMessage('Preparing your portrait metadata for IPFS…');
    try {
      if (chainId !== base.id) await switchChainAsync({ chainId: base.id });
      const response = await fetch('/api/pfp/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          displayName: displayName || 'Homie',
          style,
          consent: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not prepare the mint.');
      setMessage('Confirm the mint in your wallet…');
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS!,
        abi: CONTRACT_ABI,
        functionName: 'mint',
        args: [data.tokenURI],
        value: isFree ? 0n : parseEther('0.0005'),
        chainId: base.id,
      });
      setMessage(`Transaction submitted: ${hash.slice(0, 10)}…`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Mint failed or was cancelled.');
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    if (receipt.isSuccess) {
      setMessage('Your Homiefy NFT is minted on Base. Download the portrait to use it as your social profile picture.');
      total.refetch();
      freeClaimed.refetch();
    }
  }, [receipt.isSuccess]);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: miniApp ? '20px 14px 48px' : '40px 20px 72px', color: 'var(--foreground)' }}>
      <section style={{ background: 'linear-gradient(140deg, #17111f, #101514)', border: '1px solid rgba(167,139,250,.35)', borderRadius: 26, padding: 'clamp(22px, 5vw, 42px)', marginBottom: 22 }}>
        <p style={{ color: '#a78bfa', fontSize: 12, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase' }}>Homiehouse PFP Studio</p>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 54px)', lineHeight: 1.02, margin: '10px 0 14px' }}>Homie-fy your profile.</h1>
        <p style={{ color: '#d4d0dc', maxWidth: 680, lineHeight: 1.65, margin: 0 }}>
          Bring your Farcaster or X profile into an original digital campus with expressive style, familiar energy, and your identity at the center.
        </p>
        <p style={{ color: '#a6a0b0', fontSize: 13, margin: '16px 0 0' }}>One free NFT mint per wallet · then 0.0005 ETH · Base · {totalLabel}</p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', gap: 20 }}>
        <section style={{ border: '1px solid var(--border, #30283b)', borderRadius: 22, padding: 22, background: 'var(--card, #15131a)' }}>
          <h2 style={{ fontSize: 20, marginTop: 0 }}>1. Choose your source</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['farcaster', 'x'] as const).map(item => (
              <button key={item} type="button" onClick={() => { setPlatform(item); setProfileImageUrl(''); setImageBase64(''); }} style={{
                flex: 1, borderRadius: 12, border: '1px solid #5b4b70', padding: '11px 12px',
                background: platform === item ? '#5b2bbf' : 'transparent', color: 'white', fontWeight: 700, cursor: 'pointer',
              }}>{item === 'x' ? 'X / Twitter' : 'Farcaster'}</button>
            ))}
          </div>
          <label style={{ display: 'block', fontSize: 13, color: '#c8c0d5', marginBottom: 7 }}>Username</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder={platform === 'x' ? '@yourname' : '@yourname'} style={{ minWidth: 0, flex: 1, borderRadius: 12, padding: 12, background: '#0c0b10', color: 'white', border: '1px solid #4a4057' }} />
            <button onClick={lookupProfile} disabled={busy !== ''} style={{ border: 0, borderRadius: 12, background: '#7c3aed', color: 'white', padding: '0 15px', fontWeight: 700, cursor: 'pointer' }}>{busy === 'lookup' ? 'Loading…' : 'Scan'}</button>
          </div>
          <p style={{ color: '#a6a0b0', fontSize: 12, lineHeight: 1.5 }}>Or upload a JPG, PNG, or WebP portrait. Review the photo before generating.</p>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0] || null; setUpload(file); setProfileImageUrl(''); setImageBase64(''); }} />
          {(uploadPreview || profileImageUrl) && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={uploadPreview || profileImageUrl} alt="Selected profile source" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 18, border: '2px solid #8b5cf6' }} />
              <span style={{ color: '#d5cde0', fontSize: 14 }}>{displayName || 'Selected photo'}</span>
            </div>
          )}
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18, color: '#d5cde0', fontSize: 13, lineHeight: 1.5 }}>
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
            I own this profile/photo or have permission to use it. I understand only minted portraits are stored on IPFS.
          </label>
        </section>

        <section style={{ border: '1px solid var(--border, #30283b)', borderRadius: 22, padding: 22, background: 'var(--card, #15131a)' }}>
          <h2 style={{ fontSize: 20, marginTop: 0 }}>2. Choose your campus style</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {STYLES.map(item => (
              <button key={item.id} type="button" onClick={() => setStyle(item.id)} style={{
                border: `1px solid ${style === item.id ? '#a78bfa' : '#42384d'}`,
                background: style === item.id ? 'rgba(124,58,237,.18)' : 'transparent',
                color: 'white', borderRadius: 14, padding: 14, textAlign: 'left', cursor: 'pointer',
              }}>
                <strong style={{ display: 'block', marginBottom: 4 }}>{item.name}</strong>
                <span style={{ color: '#aaa3b4', fontSize: 13 }}>{item.detail}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={generate} disabled={busy !== '' || !consent} style={{ width: '100%', marginTop: 16, border: 0, borderRadius: 14, padding: 14, background: '#86efac', color: '#122319', fontWeight: 800, cursor: 'pointer' }}>
            {busy === 'generate' ? 'Creating your portrait…' : 'Generate my Homiefy PFP'}
          </button>
        </section>
      </div>

      {previewUrl && (
        <section style={{ marginTop: 20, border: '1px solid rgba(134,239,172,.35)', borderRadius: 22, padding: 22, background: '#111614', display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', gap: 22, alignItems: 'center' }}>
          <img src={previewUrl} alt="Your generated Homiefy portrait" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 22 }} />
          <div>
            <h2 style={{ marginTop: 0 }}>Your new look is ready.</h2>
            <p style={{ color: '#b7c1b9', lineHeight: 1.6 }}>Download it for your Farcaster or X profile, or mint it as a capped Homiefy NFT. Minting stores the image and metadata on IPFS.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '16px 0' }}>
              <a href={previewUrl} download="homiehouse-pfp.png" style={{ display: 'inline-block', borderRadius: 12, padding: '12px 16px', background: '#24212b', color: 'white', textDecoration: 'none', fontWeight: 700 }}>Download PFP</a>
              {isConnected ? <ConnectButton showBalance={false} /> : null}
              <button type="button" onClick={mint} disabled={busy !== '' || soldOut} style={{ border: 0, borderRadius: 12, padding: '12px 16px', background: isFree ? '#a78bfa' : '#7c3aed', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
                {busy === 'mint' ? 'Preparing mint…' : soldOut ? 'Sold out' : isFree ? 'Mint free NFT' : 'Mint for 0.0005 ETH'}
              </button>
            </div>
            {isConnected && address ? <p style={{ color: '#aaa3b4', fontSize: 12, overflowWrap: 'anywhere' }}>Wallet: {address}</p> : <p style={{ color: '#aaa3b4', fontSize: 13 }}>Connect your wallet to mint. Your first NFT mint is free for this wallet.</p>}
          </div>
        </section>
      )}

      {message && <p role="status" style={{ marginTop: 16, borderRadius: 14, padding: 14, background: '#17131f', color: '#e8e0f0', lineHeight: 1.55 }}>{message}</p>}
      {receipt.isError && <p role="alert" style={{ color: '#fca5a5' }}>The mint transaction did not confirm. You can retry from this portrait.</p>}
      {!addressReady && <p style={{ marginTop: 12, color: '#d6b779', fontSize: 13 }}>The studio can generate and download portraits now. NFT minting activates after the Base contract is deployed and configured.</p>}
    </main>
  );
}
