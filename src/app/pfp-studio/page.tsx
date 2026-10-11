'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAuthHeaders } from '@/lib/client-auth';

type StudioStatus = { freeAvailable: boolean; userCount: number; remaining: number; recipient: string; chainId: number };
const RECIPIENT = '0x91275b7C72902f9fDAD3FE4168d5C2CAa81bb432';
const STYLES = [
  { id: 'campus', name: 'Campus Day', detail: 'Sunlit courtyard and streetwear' },
  { id: 'afterclass', name: 'After Class', detail: 'A cozy creative lounge' },
  { id: 'homecoming', name: 'Campus Celebration', detail: 'A joyful evening gathering' },
];

export default function PfpStudioPage() {
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [profileQuery, setProfileQuery] = useState('');
  const [portraitName, setPortraitName] = useState('');
  const [image, setImage] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [style, setStyle] = useState('campus');
  const [consent, setConsent] = useState(false);
  const [paymentTxHash, setPaymentTxHash] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const headers = useCallback(() => {
    const auth = getAuthHeaders();
    if (!auth) return null;
    const requestHeaders = new Headers();
    Object.entries(auth).forEach(([key, value]) => {
      if (value) requestHeaders.set(key, value);
    });
    return requestHeaders;
  }, []);
  const refresh = useCallback(async () => {
    const auth = headers();
    if (!auth) { setMessage('Sign in with Farcaster to start your studio session.'); return; }
    try {
      const response = await fetch('/api/pfp-studio', { headers: auth });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load your studio.');
      setStatus(data);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load your studio.');
    }
  }, [headers]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function lookupProfile() {
    setMessage('');
    setImage('');
    setResult('');
    const query = profileQuery.trim();
    if (!query) return;
    if (/^https:\/\//i.test(query)) {
      setImage(query);
      setSourceName('Profile image URL');
      return;
    }
    const username = query.replace(/^@/, '');
    try {
      const response = await fetch(`/api/profile?username=${encodeURIComponent(username)}`);
      const data = await response.json();
      if (!response.ok || !data.pfp_url) throw new Error(data.error || 'No Farcaster profile photo found. Try an X photo URL or upload an image.');
      setImage(data.pfp_url);
      const resolvedName = data.display_name || data.username || username;
      setPortraitName(resolvedName);
      setSourceName(`Farcaster @${data.username || username}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not find that profile.');
    }
  }

  async function uploadImage(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4_000_000) {
      setMessage('Choose a PNG, JPEG, or WebP image under 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImage(reader.result);
        setSourceName(file.name);
        setResult('');
        setMessage('');
      }
    };
    reader.readAsDataURL(file);
  }

  async function generate() {
    const auth = headers();
    if (!auth) { setMessage('Sign in with Farcaster to generate a PFP.'); return; }
    if (!portraitName.trim()) { setMessage('Enter the name to personalize your portrait.'); return; }
    if (!image || !consent) { setMessage('Choose a source photo and confirm consent first.'); return; }
    if (status && !status.freeAvailable && !paymentTxHash.trim()) {
      setMessage('Your first PFP is free. Enter a new Base transaction hash for each additional generation.');
      return;
    }
    setBusy(true);
    setMessage('');
    setResult('');
    try {
      const response = await fetch('/api/pfp-studio', {
        method: 'POST',
        headers: (() => {
          const requestHeaders = new Headers(auth);
          requestHeaders.set('Content-Type', 'application/json');
          return requestHeaders;
        })(),
        body: JSON.stringify({ image, name: portraitName, style, paymentTxHash: paymentTxHash.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'PFP generation failed.');
      setResult(data.image);
      setPaymentTxHash('');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'PFP generation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function copyRecipient() {
    try { await navigator.clipboard.writeText(RECIPIENT); setMessage('Base recipient copied.'); }
    catch { setMessage(RECIPIENT); }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-[var(--text-on-dark)]">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-300">Homiehouse Creative Studio</p>
        <h1 className="mt-2 text-3xl font-bold">Homie-fy your PFP</h1>
        <p className="mt-3 max-w-2xl text-sm opacity-80">Turn your profile photo into an original Homiehouse campus portrait. Your photo is sent to the image provider only when you press Generate and is not saved by this studio.</p>
      </header>

      <section className="space-y-6 rounded-2xl border border-white/10 bg-black/20 p-5">
        <div>
          <label htmlFor="portrait-name" className="mb-2 block font-semibold">Name for your portrait</label>
          <input id="portrait-name" value={portraitName} onChange={e => setPortraitName(e.target.value)} maxLength={60} autoComplete="name" placeholder="Your name" className="mb-4 min-h-11 w-full rounded-lg border border-white/20 bg-black/30 px-3" />
          <label htmlFor="profile-source" className="mb-2 block font-semibold">Choose your current profile photo</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="profile-source" value={profileQuery} onChange={e => setProfileQuery(e.target.value)} placeholder="Farcaster username or current public PFP image URL" className="min-h-11 flex-1 rounded-lg border border-white/20 bg-black/30 px-3" />
            <button type="button" onClick={() => void lookupProfile()} className="min-h-11 rounded-lg bg-white/10 px-4 font-semibold">Find photo</button>
          </div>
          <p className="mt-2 text-xs opacity-70">Farcaster usernames fill in your display name and current PFP. For X, paste your current public PFP image URL, enter your name above, or upload a photo.</p>
          <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold">
            Upload photo
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e => void uploadImage(e.target.files?.[0])} />
          </label>
        </div>

        {image && (
          <div className="flex items-center gap-4 rounded-xl bg-white/5 p-3">
            <img src={image} alt="Selected profile photo preview" className="h-20 w-20 rounded-full object-cover" />
            <div><p className="font-semibold">Photo selected</p><p className="text-sm opacity-70">{sourceName}</p></div>
            <button type="button" onClick={() => { setImage(''); setResult(''); }} className="ml-auto text-sm underline">Remove</button>
          </div>
        )}

        <fieldset>
          <legend className="mb-3 font-semibold">Pick a scene</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {STYLES.map(option => (
              <label key={option.id} className={`cursor-pointer rounded-xl border p-3 ${style === option.id ? 'border-purple-300 bg-purple-500/15' : 'border-white/15'}`}>
                <input className="sr-only" type="radio" name="style" value={option.id} checked={style === option.id} onChange={() => setStyle(option.id)} />
                <span className="block font-semibold">{option.name}</span><span className="mt-1 block text-xs opacity-70">{option.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-start gap-3 text-sm">
          <input className="mt-1" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
          <span>I have permission to use this image. I understand it will be sent to the configured image provider to create my portrait. Homiehouse won’t set my social avatar automatically.</span>
        </label>

        <div className="rounded-xl bg-white/5 p-4 text-sm">
          {status?.freeAvailable
            ? <p>Your first successful PFP is free. Additional generations cost <strong>0.0005 ETH on Base</strong>. {status.remaining.toLocaleString()} of 10,000 studio slots remain.</p>
            : <p>Each additional generation costs <strong>0.0005 ETH on Base</strong>. {status?.remaining.toLocaleString() ?? '…'} of 10,000 studio slots remain.</p>}
          {status && !status.freeAvailable && (
            <div className="mt-3 space-y-2">
              <p>Send 0.0005 ETH on Base to this Homiehouse address:</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all text-xs">{RECIPIENT}</code>
                <button type="button" onClick={() => void copyRecipient()} className="rounded bg-white/10 px-3 py-1">Copy</button>
                <a className="underline" href={`https://basescan.org/address/${RECIPIENT}`} target="_blank" rel="noreferrer">View on BaseScan</a>
              </div>
              <label className="block">Base payment transaction hash
                <input value={paymentTxHash} onChange={e => setPaymentTxHash(e.target.value)} placeholder="0x…" className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-black/30 px-3" />
              </label>
            </div>
          )}
        </div>

        <button type="button" disabled={busy || !image || !portraitName.trim() || !consent || (status?.remaining === 0)} onClick={() => void generate()} className="min-h-12 w-full rounded-xl bg-purple-600 px-4 font-bold disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'Creating your portrait…' : 'Generate my PFP'}
        </button>
        {message && <p role="status" className="break-all text-sm text-amber-200">{message}</p>}
      </section>

      {result && <section className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
        <h2 className="text-xl font-bold">{portraitName}’s Homiehouse portrait</h2>
        <img src={result} alt="Generated Homiehouse campus portrait" className="mx-auto mt-4 aspect-square w-full max-w-sm rounded-2xl object-cover" />
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={result} download="homiehouse-pfp.png" className="rounded-lg bg-white/10 px-4 py-2 font-semibold">Download PNG</a>
          <button type="button" onClick={() => void generate()} disabled={busy} className="rounded-lg bg-white/10 px-4 py-2 font-semibold">Make another</button>
        </div>
        <p className="mt-3 text-xs opacity-70">Choose where to use it yourself. Homiehouse doesn’t update Farcaster or X profile photos for you.</p>
      </section>}
    </main>
  );
}
