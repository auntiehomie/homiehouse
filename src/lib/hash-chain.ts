/**
 * Pure logic for the interactive block-chain lesson scene.
 *
 * The scene teaches concept #1 of the blockchain-basics module ("what a block
 * contains and how blocks link together") by letting the learner add
 * transactions, mine blocks, then tamper with an old transaction and watch
 * every later link visibly break. The hash here is deliberately NOT
 * cryptographic (FNV-1a) — the lesson point is chaining, not security.
 */

export interface BlockChainBlock {
  id: number;
  txs: string[];
  /** FNV-1a hash of `prevHash + id + txs.join('|')`. */
  hash: string;
  prevHash: string;
}

export const GENESIS_PREV = '0'.repeat(8);
export const EMPTY_HASH = '-'.repeat(8);

/** Stable, tiny, non-cryptographic hash for teaching purposes only. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function blockHash(id: number, txs: string[], prevHash: string): string {
  return fnv1a(`${prevHash}|${id}|${txs.join('|')}`);
}

/** A mined block carries a sealed hash; a pending one (even with txs) does not. */
export function isMined(block: BlockChainBlock): boolean {
  return Boolean(block.hash) && block.hash !== EMPTY_HASH;
}

/**
 * The visible chain link between two blocks. A full node does not trust the
 * stored `prev.hash`: it RECOMPUTES the hash from the block's contents and
 * checks the next block's `prevHash` against that. Tampering with an old
 * transaction therefore breaks the link even though no stored field changed.
 */
export function linkStatus(
  prev: BlockChainBlock | undefined,
  next: BlockChainBlock | undefined,
): 'ok' | 'broken' | 'pending' {
  if (!prev || !next || !isMined(prev) || !isMined(next)) return 'pending';
  const recomputed = blockHash(prev.id, prev.txs, prev.prevHash);
  return next.prevHash === recomputed ? 'ok' : 'broken';
}

/**
 * Tamper with a transaction inside an already-mined block WITHOUT re-mining
 * it: the stored `hash` no longer matches the block's contents, so the link
 * to the next block is broken even though nothing was recomputed.
 */
export function tamperTx(
  chain: BlockChainBlock[],
  blockId: number,
  txIndex: number,
  replacement: string,
): BlockChainBlock[] {
  return chain.map((block) => {
    if (block.id !== blockId || !chain[blockId]) return block;
    const txs = [...block.txs];
    if (txIndex < 0 || txIndex >= txs.length || !replacement.trim()) return block;
    txs[txIndex] = replacement.trim();
    // The stored hash stays stale on purpose: that is the lesson.
    return { ...block, txs, hash: block.hash, prevHash: block.prevHash };
  });
}

/** How many links in the chain are currently broken (tamper damage spread). */
export function brokenLinkCount(chain: BlockChainBlock[]): number {
  let broken = 0;
  for (let i = 1; i < chain.length; i++) {
    if (linkStatus(chain[i - 1], chain[i]) === 'broken') broken++;
  }
  return broken;
}

/** Build a fresh chain: genesis mined, block 1 pending. */
export function freshChain(): BlockChainBlock[] {
  const genesis: BlockChainBlock = { id: 0, txs: ['Homie mints 1 HH2'], hash: '', prevHash: GENESIS_PREV };
  genesis.hash = blockHash(genesis.id, genesis.txs, genesis.prevHash);
  const pending: BlockChainBlock = { id: 1, txs: [], hash: EMPTY_HASH, prevHash: '' };
  return [genesis, pending];
}

/** Add a transaction to the trailing pending block (max 3 per block). */
export function addTx(chain: BlockChainBlock[], tx: string): BlockChainBlock[] {
  if (!tx.trim()) return chain;
  const next = [...chain];
  const last = next[next.length - 1];
  if (last.txs.length >= 3) return chain;
  next[next.length - 1] = { ...last, txs: [...last.txs, tx.trim()] };
  return next;
}

/** Mine the trailing pending block, then append a new pending block. */
export function minePending(chain: BlockChainBlock[]): BlockChainBlock[] {
  const pending = chain[chain.length - 1];
  if (!pending || isMined(pending) || pending.txs.length === 0) return chain;
  const prev = chain[chain.length - 2];
  const hash = blockHash(pending.id, pending.txs, prev.hash);
  const mined = { ...pending, hash, prevHash: prev.hash };
  const newPending: BlockChainBlock = { id: mined.id + 1, txs: [], hash: EMPTY_HASH, prevHash: '' };
  return [...chain.slice(0, -1), mined, newPending];
}
