'use client';

import { useEffect } from 'react';
import SignInButton from '@/components/SignInButton';
import SignerManager from '@/components/SignerManager';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { useFarcasterWrites } from '@/hooks/useFarcasterWrites';

/** Same-origin signer adapter. The native host persists credentials in Keychain. */
export default function IOSConnectPage() {
  const { fid, isAuthenticated, signOut } = useFarcasterAuth();
  const { hasActiveSigner, submitCast, reply } = useFarcasterWrites();

  useEffect(() => {
    const bridge = {
      status: () => ({ fid: isAuthenticated ? fid : null, canPublish: isAuthenticated && hasActiveSigner }),
      publish: async (input: { text: string; parentHash?: string; parentFid?: number }) => {
        if (!isAuthenticated || !fid || !hasActiveSigner) throw new Error('Sign in and approve a signer first.');
        if (typeof input.text !== 'string' || !input.text.trim() || new TextEncoder().encode(input.text).length > 1024) {
          throw new Error('Enter a cast of up to 1,024 UTF-8 bytes.');
        }
        if (input.parentHash && (!/^0x[0-9a-f]{40}$/i.test(input.parentHash) || !Number.isSafeInteger(input.parentFid) || input.parentFid! <= 0)) {
          throw new Error('Invalid reply target.');
        }
        const result = input.parentHash
          ? await reply({ text: input.text, parentCastHash: input.parentHash, parentCastFid: input.parentFid! })
          : await submitCast({ text: input.text });
        if (!result.castHash) throw new Error('The node did not acknowledge this cast. Check your profile before retrying.');
        return result.castHash;
      },
      saveAccount: () => {
        if (!fid || !hasActiveSigner) return null;
        return { fid, signer: localStorage.getItem(`signer_${fid}`), profile: localStorage.getItem('hh_profile') };
      },
      restoreAccount: (account: { fid: number; signer: string; profile: string }) => {
        if (!Number.isSafeInteger(account.fid) || account.fid <= 0) throw new Error('Invalid saved account.');
        const signer = JSON.parse(account.signer);
        const profile = JSON.parse(account.profile);
        if (profile.fid !== account.fid || signer.status !== 'approved' || !/^(?:0x)?[0-9a-f]{64}$/i.test(signer.private_key)) {
          throw new Error('Saved signer could not be restored. Connect your account again.');
        }
        localStorage.setItem(`signer_${account.fid}`, account.signer);
        localStorage.setItem('hh_profile', account.profile);
        window.dispatchEvent(new Event('hh:auth:changed'));
        window.dispatchEvent(new Event('hh:signer:approved'));
        return true;
      },
      signOut: async () => { signOut(); return true; },
    };
    const target = window as typeof window & { homiehouseIOS?: typeof bridge };
    target.homiehouseIOS = bridge;
    return () => { delete target.homiehouseIOS; };
  }, [fid, isAuthenticated, hasActiveSigner, submitCast, reply, signOut]);

  return <main className="mx-auto max-w-lg p-6 space-y-6">
    <h1 className="text-2xl font-semibold">Connect Homiehouse</h1>
    <SignInButton />
    {isAuthenticated && <><p>Account connected.</p><SignerManager /></>}
  </main>;
}
