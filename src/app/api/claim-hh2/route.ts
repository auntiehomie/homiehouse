import { NextResponse } from 'next/server';

const CLAIMS_PAUSED_MESSAGE = 'HH2 claims are paused while the reward system is secured. No token transfers can be made through this endpoint.';

// HH2 rewards are intentionally disabled until completion records are server-authoritative
// and existing progress and claims have been reconciled. Do not restore treasury transfers
// based on client-authored learning_progress.completed_ids.
export async function GET() {
  return NextResponse.json({
    ok: true,
    claimsPaused: true,
    message: CLAIMS_PAUSED_MESSAGE,
    claimable: 0,
    claimableModules: 0,
    totalClaimed: 0,
    claims: [],
  });
}

// Fail closed for every caller, including clients that bypass the UI.
export async function POST() {
  return NextResponse.json(
    { ok: false, claimsPaused: true, error: CLAIMS_PAUSED_MESSAGE },
    { status: 503 }
  );
}
