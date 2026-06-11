/**
 * One-time setup script: generate & register a Farcaster signer for @homiehouselol.
 *
 * Run:
 *   MNEMONIC="your twelve word phrase here" APP_FID=12345 npx tsx scripts/setup-agent-signer.ts
 *
 * What it does:
 *   1. Derives the EVM custody wallet from your mnemonic
 *   2. Generates a fresh Ed25519 keypair
 *   3. Signs a Farcaster SignedKeyRequest EIP-712 message
 *   4. Registers it with Warpcast
 *   5. Prints the deep-link → open in Warpcast while logged in as @homiehouselol to approve
 *   6. Polls until approved, then prints the env vars to paste into Vercel
 */

import { ed25519 } from '@noble/curves/ed25519';
import { mnemonicToAccount } from 'viem/accounts';

const WARPCAST_API = 'https://api.warpcast.com';

const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
  name: 'Farcaster SignedKeyRequestValidator',
  version: '1',
  chainId: 10,
  verifyingContract: '0x00000000fc700472606ed4fa22623acf62c60553' as `0x${string}`,
} as const;

const SIGNED_KEY_REQUEST_TYPE = [
  { name: 'requestFid', type: 'uint256' },
  { name: 'key', type: 'bytes' },
  { name: 'deadline', type: 'uint256' },
] as const;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const mnemonic = process.env.MNEMONIC?.trim().replace(/^["']|["']$/g, '');
  const fidStr = process.env.APP_FID;

  if (!mnemonic) {
    console.error('❌  Set MNEMONIC="your twelve word phrase" before running.');
    process.exit(1);
  }
  if (!fidStr) {
    console.error('❌  Set APP_FID=<your farcaster FID> before running.');
    console.error('    Look it up at: https://www.farcaster.xyz/@homiehouselol');
    process.exit(1);
  }

  const appFid = parseInt(fidStr, 10);
  if (isNaN(appFid) || appFid <= 0) {
    console.error('❌  APP_FID must be a positive integer.');
    process.exit(1);
  }

  console.log(`\n🔑  Setting up signer for FID ${appFid}…\n`);

  // Step 1: derive the custody wallet from the mnemonic
  let account: ReturnType<typeof mnemonicToAccount>;
  try {
    account = mnemonicToAccount(mnemonic as `${string}`);
  } catch (e: any) {
    console.error('❌  Invalid mnemonic:', e.message);
    process.exit(1);
  }
  console.log(`    Custody address: ${account.address}`);

  // Step 2: generate a fresh Ed25519 keypair
  const privateKeyBytes = ed25519.utils.randomPrivateKey();
  const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes);
  const publicKeyHex = `0x${Buffer.from(publicKeyBytes).toString('hex')}` as `0x${string}`;
  const privateKeyHex = Buffer.from(privateKeyBytes).toString('hex');

  console.log(`    Ed25519 pubkey:  ${publicKeyHex.slice(0, 20)}…`);

  // Step 3: sign the EIP-712 SignedKeyRequest
  const deadline = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // valid 24 h

  const signature = await account.signTypedData({
    domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
    types: { SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE },
    primaryType: 'SignedKeyRequest',
    message: {
      requestFid: BigInt(appFid),
      key: publicKeyHex,
      deadline: BigInt(deadline),
    },
  });

  // Step 4: register with Warpcast
  const registerRes = await fetch(`${WARPCAST_API}/v2/signed-key-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ key: publicKeyHex, requestFid: appFid, deadline, signature }),
  });

  if (!registerRes.ok) {
    const txt = await registerRes.text();
    console.error(`❌  Warpcast registration failed (${registerRes.status}): ${txt.slice(0, 300)}`);
    process.exit(1);
  }

  const { result } = await registerRes.json();
  const skr = result?.signedKeyRequest ?? result;
  const token: string = skr.token;
  const approvalUrl: string = skr.deeplinkUrl;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📱  APPROVAL REQUIRED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n  Open this link in Warpcast while logged in as @homiehouselol:');
  console.log(`\n  ${approvalUrl}\n`);
  console.log('  (The link expires in 24 hours)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⏳  Waiting for approval (polls every 5 s)…\n');

  // Step 5: poll until approved
  let approved = false;
  for (let attempt = 0; attempt < 720; attempt++) {
    // max ~1 hour
    await sleep(5000);

    try {
      const statusRes = await fetch(
        `${WARPCAST_API}/v2/signed-key-request?token=${encodeURIComponent(token)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();
      const state: string =
        statusData.result?.signedKeyRequest?.state ??
        statusData.result?.state ??
        statusData.state;

      process.stdout.write(`\r    Status: ${state}   `);

      if (state === 'completed') {
        approved = true;
        break;
      }
    } catch {
      // transient network error — keep polling
    }
  }

  console.log('\n');

  if (!approved) {
    console.error('❌  Timed out waiting for approval.');
    console.error('    The link is still valid for 24 h — re-run the script or approve manually.\n');
    // Still print the key so the user doesn't lose it
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(approved ? '✅  APPROVED — paste these into Vercel env vars:' : '⚠️  Add these env vars AFTER approving the link above:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  HOMIEHOUSELOL_FID=${appFid}`);
  console.log(`  HOMIEHOUSELOL_SIGNER_KEY=${privateKeyHex}`);
  console.log(`  APP_FID=${appFid}`);
  console.log(`  APP_MNEMONIC="${mnemonic}"`);
  console.log(`  CRON_SECRET=<generate one: openssl rand -hex 32>\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('  After adding env vars, redeploy on Vercel for them to take effect.\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
