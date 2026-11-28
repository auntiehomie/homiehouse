import protobuf from 'protobufjs';
import { createHash } from 'crypto';
import { hashTypedData, recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { blake3_20 } from '@/lib/fc-message-builder';
import {
  encodeNativeOnboardMessage,
  isNativeFid,
  mineRegistrationPow,
  nativeOnboardTypedData,
  parseFid,
  powGateCommitment,
  powHash,
  powTargetMet,
  verifyNativeOnboardPow,
  type NativeOnboardProof,
} from '@/lib/hypersnap-native';

// The relevant subset of farcasterorg/hypersnap proto/definitions/message.proto.
const PROTO = `
syntax = "proto3";
message Message {
  MessageData data = 1;
  bytes hash = 2;
  int32 hash_scheme = 3;
  bytes signature = 4;
  int32 signature_scheme = 5;
  bytes signer = 6;
  optional bytes data_bytes = 7;
}
message MessageData {
  int32 type = 1;
  uint64 fid = 2;
  uint32 timestamp = 3;
  int32 network = 4;
  optional bytes native_onboard_body = 1160;
}
message PowSolution { bytes nonce = 1; uint32 difficulty_bits = 2; }
message HyperNativeOnboardBody {
  bytes custody_address = 1;
  bytes custody_signature = 2;
  uint64 anchor_block_height = 3;
  bytes anchor_block_hash = 4;
  oneof gate_proof { PowSolution pow = 5; }
}
`;
const root = protobuf.parse(PROTO, { keepCase: true }).root;
const MessageT = root.lookupType('Message');
const MessageDataT = root.lookupType('MessageData');
const BodyT = root.lookupType('HyperNativeOnboardBody');

const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const anchorHash = `0x${'42'.repeat(32)}` as const;

function proofFor(bits: number): NativeOnboardProof {
  const custody = Buffer.from(account.address.slice(2), 'hex');
  const nonce = mineRegistrationPow(custody, Buffer.from(anchorHash.slice(2), 'hex'), bits);
  return {
    custodyAddress: account.address.toLowerCase() as `0x${string}`,
    anchorBlockHeight: 50_990_000,
    anchorBlockHash: anchorHash,
    nonce: `0x${nonce.toString('hex')}`,
    difficultyBits: bits,
  };
}

describe('native Hypersnap registration', () => {
  it('recognises native FIDs and parses JSON string FIDs', () => {
    expect(isNativeFid(4_294_967_295)).toBe(false);
    expect(isNativeFid(4_294_967_296)).toBe(true);
    expect(isNativeFid('4294967300')).toBe(true);
    expect(parseFid('4294967296')).toBe(4_294_967_296);
    expect(parseFid(1234)).toBe(1234);
    expect(parseFid('-1')).toBeNull();
    expect(parseFid('99999999999999999999')).toBeNull();
  });

  it('checks leading zero bits like the node', () => {
    const hash = new Uint8Array(32);
    hash[0] = 0; hash[1] = 0; hash[2] = 0b0011_1111;
    expect(powTargetMet(hash, 18)).toBe(true);
    expect(powTargetMet(hash, 19)).toBe(false);
    expect(powTargetMet(new Uint8Array(32).fill(0xff), 1)).toBe(false);
  });

  it('mines a proof the node-side check accepts', () => {
    const proof = proofFor(12);
    expect(Buffer.from(proof.nonce.slice(2), 'hex')).toHaveLength(8);
    expect(verifyNativeOnboardPow(proof)).toBe(true);
    expect(verifyNativeOnboardPow({ ...proof, difficultyBits: 40 })).toBe(false);
    const manual = createHash('sha256')
      .update('hyper.onboard.pow:')
      .update(Buffer.from(proof.custodyAddress.slice(2), 'hex'))
      .update(Buffer.from(anchorHash.slice(2), 'hex'))
      .update(Buffer.from(proof.nonce.slice(2), 'hex'))
      .digest();
    expect(powHash(
      Buffer.from(proof.custodyAddress.slice(2), 'hex'),
      Buffer.from(anchorHash.slice(2), 'hex'),
      Buffer.from(proof.nonce.slice(2), 'hex'),
    )).toEqual(manual);
  });

  it('commits to the nonce and difficulty in the signed gate commitment', () => {
    const nonce = Buffer.from('0000000000000007', 'hex');
    const bits = Buffer.from([0, 0, 0, 22]);
    const expected = createHash('sha256').update('hyper.onboard.pow.commitment:').update(nonce).update(bits).digest();
    expect(powGateCommitment(nonce, 22)).toEqual(expected);
  });

  it('builds typed data the custody wallet signature recovers from', async () => {
    const proof = proofFor(8);
    const typed = nativeOnboardTypedData(proof);
    expect(typed.domain).toEqual({ name: 'HypersnapNativeOnboard', version: '1', chainId: 10 });
    const signature = await account.signTypedData(typed);
    await expect(recoverTypedDataAddress({ ...typed, signature })).resolves.toBe(account.address);
    // Changing the anchor changes what is signed.
    expect(hashTypedData(nativeOnboardTypedData({ ...proof, anchorBlockHeight: 1 }))).not.toBe(hashTypedData(typed));
  });

  it('encodes a NATIVE_ONBOARD message that decodes with the Hypersnap schema', async () => {
    const proof = proofFor(8);
    const custodySignature = await account.signTypedData(nativeOnboardTypedData(proof));
    const { messageBytes, hash, dataBytes } = encodeNativeOnboardMessage(
      { ...proof, custodySignature },
      { timestamp: 123_456 },
    );

    const message = MessageT.decode(messageBytes) as any;
    expect(Buffer.from(message.hash)).toEqual(Buffer.from(blake3_20(dataBytes)));
    expect(Buffer.from(hash)).toEqual(Buffer.from(message.hash));
    expect(message.hash_scheme).toBe(1);
    expect(message.signature?.length ?? 0).toBe(0);
    expect(message.signer?.length ?? 0).toBe(0);
    expect(message.signature_scheme ?? 0).toBe(0);

    const data = MessageDataT.decode(message.data_bytes) as any;
    expect(data.type).toBe(160);
    expect(Number(data.fid ?? 0)).toBe(0);
    expect(data.timestamp).toBe(123_456);
    expect(data.network).toBe(1);

    const body = BodyT.decode(data.native_onboard_body) as any;
    expect(`0x${Buffer.from(body.custody_address).toString('hex')}`).toBe(proof.custodyAddress);
    expect(`0x${Buffer.from(body.custody_signature).toString('hex')}`).toBe(custodySignature);
    expect(Number(body.anchor_block_height)).toBe(proof.anchorBlockHeight);
    expect(`0x${Buffer.from(body.anchor_block_hash).toString('hex')}`).toBe(anchorHash);
    expect(`0x${Buffer.from(body.pow.nonce).toString('hex')}`).toBe(proof.nonce);
    expect(body.pow.difficulty_bits).toBe(8);

    // Re-encoding the decoded data reproduces the hashed bytes.
    expect(Buffer.from(MessageDataT.encode(data).finish())).toEqual(Buffer.from(dataBytes));
  });
});
