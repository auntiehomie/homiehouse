'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { PfpStudio } from '@/app/pfp/PfpStudio';

export default function HomiefyMiniApp() {
  const [identity, setIdentity] = useState<{ username: string; ready: boolean }>({ username: '', ready: false });

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const context = await sdk.context;
        if (active) setIdentity({ username: context?.user?.username || '', ready: true });
        await sdk.actions.ready();
      } catch {
        if (active) setIdentity({ username: '', ready: true });
        try { await sdk.actions.ready(); } catch {}
      }
    }
    void init();
    return () => { active = false; };
  }, []);

  if (!identity.ready) return <main style={{ padding: 24, color: 'white' }}>Opening Homiefy Studio…</main>;
  return <PfpStudio miniApp initialUsername={identity.username} />;
}
