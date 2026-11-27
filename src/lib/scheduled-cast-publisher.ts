import { buildSignedMessage, hexToBytes, MessageType } from '@/lib/fc-message-builder';
import type { CastEmbed } from '@/lib/fc-message-builder';
import { ed25519 } from '@noble/curves/ed25519';
import { decryptSignerKey } from '@/lib/signer-crypto';
import { fetchChannelParentUrl } from '@/lib/hypersnap';

import { castTypeForText } from '@/lib/cast-text';
import { submitHypersnapMessage } from '@/lib/hypersnap-submit';

export async function publishWithStoredKey(cast: any): Promise<string> {
  // Decrypt the stored signer key (encrypted at schedule time from the auth header)
  const privateKeyHex = decryptSignerKey(cast.signer_uuid);
  if (!privateKeyHex) {
    throw new Error('No valid signer key stored. Re-schedule this cast after approving posting permissions.');
  }

  const privateKeyBytes = hexToBytes(privateKeyHex);
  const publicKeyBytes = ed25519.getPublicKey(privateKeyBytes);
  const signer = {
    publicKey: publicKeyBytes,
    sign: async (hash: Uint8Array) => ed25519.sign(hash, privateKeyBytes),
  };

  const rawEmbeds: Array<{ url: string }> = Array.isArray(cast.embeds)
    ? cast.embeds
    : JSON.parse(cast.embeds || '[]');
  const castEmbeds: CastEmbed[] = rawEmbeds.map((e: { url: string }) => ({ url: e.url }));
  const parentUrl = cast.channel_id
    ? await fetchChannelParentUrl(cast.channel_id)
    : undefined;

  const message = await buildSignedMessage(
    {
      type: MessageType.CAST_ADD,
      fid: cast.user_fid,
      body: {
        castAddBody: {
          text: cast.text,
          type: castTypeForText(cast.text),
          embeds: castEmbeds.length ? castEmbeds : undefined,
          parent: parentUrl ? { url: parentUrl } : undefined,
        },
      },
    },
    signer,
  );

  const hubRes = await submitHypersnapMessage(new Uint8Array(message).buffer);
  const rawText = await hubRes.text();
  let result: any = {};
  try { result = JSON.parse(rawText); } catch { /* A malformed response cannot confirm publication. */ }
  const detail = [result.details, result.error_detail, result.errorDetail, result.error?.message,
    result.errMsg, result.message, result.error]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (!hubRes.ok || result.ok === false || result.success === false) {
    throw new Error(detail || `Hypersnap rejected scheduled cast (HTTP ${hubRes.status})`);
  }

  // A 2xx proxy response alone is not confirmation that the cast was accepted.
  const hash = result.hash ?? result.cast?.hash ?? result.data?.hash;
  if (typeof hash !== 'string' || !/^(?:0x)?[0-9a-f]{40}$/i.test(hash)) {
    throw new Error('The node did not confirm a cast hash. Check your profile before retrying.');
  }
  return hash;
}
