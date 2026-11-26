'use client';
import { useEffect, useState } from 'react';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { DEFAULT_PUSH_PREFERENCES, readPushPreferences, type PushPreferences } from '@/lib/push-preferences';
import { disableDevicePush, enableDevicePush } from '@/lib/push-client';
export default function DevicePushSettings() {
  const { fid } = useFarcasterAuth();
  const [preferences, setPreferences] = useState<PushPreferences>({ ...DEFAULT_PUSH_PREFERENCES });
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setPreferences(fid ? readPushPreferences(fid) : { ...DEFAULT_PUSH_PREFERENCES });
    setEnabled(!!fid && localStorage.getItem(`hh_push_enabled:${fid}`) === 'true');
    setMessage('');
  }, [fid]);
  async function save(disable = false) {
    if (!fid) { setMessage('Sign in to manage device notifications.'); return; }
    setBusy(true); setMessage('');
    try {
      if (disable) await disableDevicePush(fid);
      else await enableDevicePush(fid, preferences, true);
      setEnabled(!disable); setMessage(disable ? 'Notifications disabled for this device.' : 'Notification preferences saved for this device.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save preferences.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Device push notifications" className="surface rounded-xl p-4 mb-5">
    <h2 className="font-bold">Device notifications</h2>
    <p className="text-sm my-2">Opt in to replies, mentions, or new casts from your Following feed. Updates are grouped into a brief notification; no permission prompt until you enable.</p>
    <fieldset disabled={busy} className="flex flex-col gap-2 my-3">
      <legend className="sr-only">Notification types</legend>
      {([['replies', 'Replies to your casts'], ['mentions', 'Mentions of you'], ['newCasts', 'New casts from people you follow (optional)']] as const).map(([key, label]) => <label key={key} className="flex gap-2 items-center text-sm">
        <input type="checkbox" checked={preferences[key]} onChange={event => setPreferences(value => ({ ...value, [key]: event.target.checked }))} />{label}
      </label>)}
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn" disabled={busy || !fid} onClick={() => void save()}>{busy ? 'Saving…' : enabled ? 'Save notification preferences' : 'Enable notifications'}</button>
      {enabled && <button type="button" className="btn" disabled={busy} onClick={() => void save(true)}>Disable on this device</button>}
    </div>
    <p className="text-xs mt-3" style={{ color: 'var(--muted-on-dark)' }}>Requires browser support and server push configuration. On iOS, install to your Home Screen. High-volume feeds use a recent sample, so delivery is best-effort.</p>
    {message && <p role="status" className="text-sm mt-2">{message}</p>}
  </section>;
}
