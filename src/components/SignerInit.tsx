'use client'

/**
 * SignerInit — creates and manages Farcaster signer keys.
 *
 * Reads FID from FarcasterAuthProvider (which sources from localStorage hh_profile
 * and/or Frame SDK context). No longer depends on third-party auth providers.
 *
 * Listens for hh:request:signer events from Compose / WelcomeModal.
 */

import { useEffect } from 'react'
import { useFarcasterAuth } from '@/lib/farcaster-auth'

function resolveFid(farcasterFid: number | null): number | undefined {
  // 1. FarcasterAuth context (localStorage hh_profile)
  if (farcasterFid) return farcasterFid

  // 2. Frame SDK context (mini app)
  if (typeof window !== 'undefined') {
    const sdk = (window as any).sdk
    if (sdk?.context?.user?.fid) return sdk.context.user.fid
  }

  return undefined
}

export default function SignerInit() {
  const { fid } = useFarcasterAuth()

  useEffect(() => {
    const resolvedFid = resolveFid(fid)
    if (!resolvedFid) return

    initSigner(resolvedFid)

    const onRequest = (e: any) => {
      const requestFid = e.detail?.fid || resolveFid(fid)
      if (requestFid) initSigner(requestFid)
    }
    window.addEventListener('hh:request:signer', onRequest)
    return () => window.removeEventListener('hh:request:signer', onRequest)
  }, [fid])

  return null
}

async function initSigner(fid: number) {
  const key = `signer_${fid}`
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const stored = JSON.parse(raw)
      if (stored.status === 'approved' && stored.private_key) return // already good

      // Approved but private key was lost (old version of app) — must recreate
      if (stored.status === 'approved' && !stored.private_key) {
        localStorage.removeItem(key)
        // fall through to create a new signer below
      } else if (stored.signer_uuid) {
        // Check if it was approved externally since last visit
        const res = await fetch(`/api/signer?signer_uuid=${stored.signer_uuid}`)
        const data = await res.json()
        if (data.ok && data.status === 'approved') {
          stored.status = 'approved'
          localStorage.setItem(key, JSON.stringify(stored))
          window.dispatchEvent(new Event('hh:signer:approved'))
          return
        }
        // Still pending — re-show modal
        if (stored.signer_approval_url) {
          window.dispatchEvent(new CustomEvent('showWelcomeModal', {
            detail: { approvalUrl: stored.signer_approval_url },
          }))
        }
        pollForApproval(fid, stored.signer_uuid)
        return
      }
    }

    // No signer yet — create one
    const res = await fetch('/api/signer', { method: 'POST' })
    const signerData = await res.json()
    if (!signerData.ok) {
      console.error('[SignerInit] Failed to create signer:', signerData.error)
      // Show modal with error so the user isn't left in the dark
      window.dispatchEvent(new CustomEvent('showWelcomeModal', {
        detail: { approvalUrl: null, error: signerData.error },
      }))
      return
    }

    localStorage.setItem(key, JSON.stringify({
      signer_uuid: signerData.signer_uuid,
      public_key: signerData.public_key,
      private_key: signerData.private_key,   // stored client-side only
      status: 'pending_approval',
      signer_approval_url: signerData.signer_approval_url,
    }))

    if (signerData.signer_approval_url) {
      window.dispatchEvent(new CustomEvent('showWelcomeModal', {
        detail: { approvalUrl: signerData.signer_approval_url },
      }))
    }
    pollForApproval(fid, signerData.signer_uuid)
  } catch (err) {
    console.error('[SignerInit] Error:', err)
  }
}

function pollForApproval(fid: number, signerUuid: string) {
  const key = `signer_${fid}`
  let attempts = 0

  const check = async () => {
    if (attempts >= 72) return // ~6 min max
    attempts++
    try {
      const res = await fetch(`/api/signer?signer_uuid=${signerUuid}`)
      const data = await res.json()
      if (data.ok && data.status === 'approved') {
        const raw = localStorage.getItem(key)
        if (raw) {
          const stored = JSON.parse(raw)
          stored.status = 'approved'
          localStorage.setItem(key, JSON.stringify(stored))
        }
        window.dispatchEvent(new Event('hh:signer:approved'))
        return
      }
    } catch { /* ignore */ }
    setTimeout(check, 5000)
  }
  setTimeout(check, 5000)
}