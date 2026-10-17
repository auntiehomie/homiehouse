'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { useFarcasterWrites } from '@/hooks/useFarcasterWrites';
import { dismissMigrationGuide, OPEN_MIGRATION_GUIDE, shouldShowMigrationGuide } from '@/lib/migration-guide';
import styles from './MigrationGuide.module.css';

const FarcasterLogin = dynamic(() => import('./FarcasterLogin'), { ssr: false });
type Preview = { fid: number; username: string; display_name?: string };

export default function MigrationGuide() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useFarcasterAuth();
  const { hasActiveSigner, requestSigner } = useFarcasterWrites();
  const dialog = useRef<HTMLDialogElement>(null);
  const checked = useRef(false);
  const previewRequest = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const show = () => { setLogin(false); setOpen(true); };
    window.addEventListener(OPEN_MIGRATION_GUIDE, show);
    return () => window.removeEventListener(OPEN_MIGRATION_GUIDE, show);
  }, []);

  useEffect(() => {
    if (checked.current || /^\/(auth|miniapp|miniapps)(\/|$)/.test(pathname)) return;
    checked.current = true;
    try { if (shouldShowMigrationGuide(localStorage)) setOpen(true); } catch { setOpen(true); }
  }, [pathname]);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);
  useEffect(() => () => previewRequest.current?.abort(), []);

  function dismiss() {
    try { dismissMigrationGuide(localStorage); } catch { /* Private browsing may block storage access. */ }
    setOpen(false);
  }
  function visit(path: string) { dismiss(); router.push(path); }
  async function findProfile(event: FormEvent) {
    event.preventDefault();
    const name = username.trim().replace(/^@/, '');
    if (!name) return;
    previewRequest.current?.abort();
    const controller = new AbortController();
    previewRequest.current = controller;
    setBusy(true); setError(''); setPreview(null);
    try {
      const response = await fetch(`/api/profile?username=${encodeURIComponent(name)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 404 ? 'Profile not found. Check your username and try again.' : 'Could not load your profile. Please try again.');
      const data = await response.json();
      if (!data?.fid) throw new Error('Profile not found.');
      setPreview(data);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load your profile.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  return <>
    {!open && !login && !isAuthenticated && <button className="btn" onClick={() => setOpen(true)} style={{ position: 'fixed', right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', zIndex: 9000 }}>Getting started</button>}
    {open && <dialog ref={dialog} className={styles.dialog} aria-labelledby="migration-title" aria-describedby="migration-description" onCancel={dismiss}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p className={styles.note} style={{ margin: '0 0 6px' }}>YOUR NEXT HOME ON FARCASTER</p>
          <h2 id="migration-title" style={{ margin: 0, fontSize: 26, lineHeight: 1.2 }}>Make Homiehouse your home</h2>
        </div>
        <button className="btn" aria-label="Close getting started" onClick={dismiss}>×</button>
      </header>
      <p id="migration-description" style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 0 }}>Keep your Farcaster identity and reconnect with your people. Open a step below to get settled in.</p>
      <ol className={styles.steps}>
        <li className={styles.step}><span className={styles.number}>1</span><div>
          <details><summary className={styles.summary}><h3>Find your familiar face</h3></summary>
          <p>Preview your existing profile and casts. Looking up a username does not sign you in.</p>
          <form onSubmit={findProfile} className={styles.form}>
            <label className="sr-only" htmlFor="migration-username">Farcaster username</label>
            <input id="migration-username" className={styles.input} value={username} onChange={e => { previewRequest.current?.abort(); setBusy(false); setUsername(e.target.value); setPreview(null); setError(''); }} placeholder="Your Farcaster username" autoCapitalize="none" autoCorrect="off" maxLength={64} required />
            <button className="btn" disabled={busy}>{busy ? 'Finding…' : 'Preview profile'}</button>
          </form>
          {error && <p role="alert" style={{ marginTop: 8 }}>{error}</p>}
          {preview && <div role="status" style={{ marginTop: 10 }}><p>Found {preview.display_name || preview.username} · @{preview.username}</p><button className="btn" onClick={() => visit(`/profile?user=${encodeURIComponent(preview.username)}`)}>View profile and casts</button></div>}
        </details></div></li>
        <li className={styles.step}><span className={styles.number}>{isAuthenticated ? '✓' : '2'}</span><div>
          <details><summary className={styles.summary}><h3>Sign in to your existing account</h3></summary>
          <p>Connect a wallet linked to your Farcaster account, then approve the login message. Your identity and follows stay on the network.</p>
          {isAuthenticated ? <p role="status">You’re signed in.</p> : <button className="btn primary" onClick={() => { dismiss(); setLogin(true); }}>Sign in with my wallet</button>}
          <p className={styles.note} style={{ marginTop: 8 }}>No new account or fund transfer is needed. You never need to enter a recovery phrase here.</p>
        </details></div></li>
        <li className={styles.step}><span className={styles.number}>{hasActiveSigner ? '✓' : '3'}</span><div>
          <details><summary className={styles.summary}><h3>Enable posting, then say hello</h3></summary>
          <p>Posting needs a separate approval from the wallet that owns your Farcaster account. A wallet linked only for login may not be able to approve posting.</p>
          {hasActiveSigner ? <button className="btn" onClick={() => visit('/compose')}>Write your first Homiehouse cast</button> : <button className="btn" disabled={!isAuthenticated} onClick={() => { dismiss(); void requestSigner(); }}>Enable posting</button>}
          {!isAuthenticated && <p className={styles.note}>Sign in above to continue. You can browse without posting.</p>}
        </details></div></li>
        <li className={styles.step}><span className={styles.number}>4</span><div>
          <details><summary className={styles.summary}><h3>Keep your new home close</h3></summary>
          <p>On iPhone or iPad, open Homiehouse in Safari, tap Share, then Add to Home Screen. On other supported browsers, use Install app in the browser menu.</p>
          <details><summary style={{ cursor: 'pointer', fontSize: 14 }}>Replies and notifications</summary><p style={{ marginTop: 8 }}>Open Alerts to catch up on replies and mentions. On iPhone and iPad, add Homiehouse to your Home Screen before enabling push notifications.</p><button className="btn" onClick={() => { dismiss(); window.dispatchEvent(new Event('hh:push:enable')); }}>Enable notifications</button></details>
        </details></div></li>
      </ol>
      <div className={styles.actions}>
        {isAuthenticated
          ? <button className="btn primary" onClick={() => visit('/feed')}>Open my feed</button>
          : <button className="btn primary" onClick={() => { dismiss(); setLogin(true); }}>Use my existing account</button>}
        <button className="btn" onClick={() => visit('/feed')}>Explore first</button>
        <button className="btn" onClick={dismiss}>Maybe later</button>
      </div>
      <p className={styles.note}>Reopen this guide from Getting started in the menu. Profiles and casts load through Hypersnap; availability depends on the network. Private messages, drafts, and other apps’ bookmarks are not imported by this guide.</p>
    </dialog>}
    {login && <FarcasterLogin modal requestPostingOnLogin={false} onDismiss={() => { setLogin(false); setOpen(true); }} onLogin={() => { setLogin(false); setOpen(true); }} />}
  </>;
}
