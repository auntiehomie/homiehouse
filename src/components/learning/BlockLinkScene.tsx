'use client';

import { useState } from 'react';
import styles from './LessonActivity.module.css';
import {
  addTx,
  blockHash,
  brokenLinkCount,
  freshChain,
  isMined,
  linkStatus,
  minePending,
  tamperTx,
  type BlockChainBlock,
} from '@/lib/hash-chain';

const TX_POOL = [
  'Alice sends Bob 5 HH2',
  'Bob sends Carol 2 HH2',
  'Carol posts cast 0x9f…',
  'Dave sends Alice 1 HH2',
  'Eve mints a learning NFT',
];

/**
 * Interactive scene for the blockchain-basics concept "what a block contains
 * and how blocks link together". The learner fills a block with transactions,
 * mines it, then tries to edit an old transaction — and watches the hash links
 * break, which IS the explanation for why on-chain data is practically
 * immutable. No replica of Brilliant/Duolingo; the interaction is derived
 * directly from the module concept.
 */
export default function BlockLinkScene() {
  const [chain, setChain] = useState<BlockChainBlock[]>(freshChain);
  const [txCursor, setTxCursor] = useState(0);
  const [tamperBlock, setTamperBlock] = useState<number | null>(null);
  const [justMined, setJustMined] = useState(false);

  const pending = chain[chain.length - 1];
  const broken = brokenLinkCount(chain);

  function onAdd() {
    setJustMined(false);
    setChain((c) => addTx(c, TX_POOL[txCursor % TX_POOL.length]));
    setTxCursor((i) => i + 1);
  }

  function onMine() {
    setChain((c) => minePending(c));
    setJustMined(true);
  }

  function onTamper(blockId: number) {
    setJustMined(false);
    setTamperBlock((current) => (current === blockId ? null : blockId));
    // Editing the first mined block's transaction alters its content while its
    // stored hash stays stale — the next link visibly breaks.
    if (blockId === 0) setChain((c) => tamperTx(c, 0, 0, 'Alice sends Bob 999 HH2'));
  }

  return (
    <section className={styles.activity} aria-label="Interactive block chain scene">
      <h3>Build a chain, then try to break it</h3>
      <p>
        Add transactions to the pending block, mine it to seal its hash, then edit an old
        transaction and watch which links break.
      </p>

      <div className={styles.controls}>
        <button type="button" disabled={pending.txs.length >= 3} onClick={onAdd}>
          + Add transaction
        </button>
        <button type="button" disabled={!pending.txs.length} onClick={onMine}>
          ⛏ Mine block
        </button>
        <button type="button" onClick={() => { setChain(freshChain()); setTamperBlock(null); setJustMined(false); }}>
          Reset chain
        </button>
      </div>

      <ol className="hh-blockchain" aria-label="Blocks in the chain">
        <style>{`
          .hh-blockchain { list-style: none; display: flex; flex-direction: column; gap: 6px; padding: 0; margin: .75rem 0 0; }
          .hh-block { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; background: rgba(255,255,255,0.03); }
          .hh-block[data-mined='false'] { border-style: dashed; opacity: .75; }
          .hh-block[data-justmined='true'] { animation: hhBlockPop .5s cubic-bezier(.34,1.56,.64,1); }
          .hh-block[data-broken='true'] { border-color: #ef4444; animation: hhBlockBreak 1.2s ease-in-out; }
          .hh-block-meta { font-size: 12px; opacity: .8; font-family: ui-monospace, monospace; }
          .hh-link { font-size: 12px; padding-left: 10px; border-left: 2px solid #22c55e; margin: 2px 0; font-family: ui-monospace, monospace; }
          .hh-link[data-status='broken'] { border-color: #ef4444; color: #f87171; animation: hhLinkShake .4s ease-in-out 2; }
          .hh-link[data-status='pending'] { border-color: #facc15; color: #facc15; }
          @keyframes hhBlockPop { 0% { transform: scale(.92); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
          @keyframes hhBlockBreak { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } 50% { box-shadow: 0 0 14px 2px rgba(239,68,68,.55); } }
          @keyframes hhLinkShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        `}</style>
        {chain.map((block, i) => {
          const mined = isMined(block);
          const prev = chain[i - 1];
          const status = linkStatus(prev, block);
          const blockBroken = tamperBlock === block.id && broken > 0;
          return (
            <li key={block.id} className="hh-block" data-mined={mined} data-justmined={mined && justMined && i === chain.length - 2} data-broken={blockBroken}>
              <div className="hh-block-meta">
                Block {block.id} {mined ? '' : '(pending)'} · hash: <span aria-label={`hash of block ${block.id}`}>{mined ? block.hash : 'unmined'}</span>
              </div>
              {mined && block.txs.map((tx, ti) => (
                <div key={ti} style={{ fontSize: 13 }}>· {tx}</div>
              ))}
              {mined && block.txs.length === 0 && <div style={{ fontSize: 13, opacity: .6 }}>· (empty)</div>}
              {!mined && block.txs.map((tx, ti) => (
                <div key={ti} style={{ fontSize: 13, opacity: .8 }}>· {tx} <em>(unconfirmed)</em></div>
              ))}
              {i > 0 && (
                <div className="hh-link" data-status={status}>
                  {status === 'ok' && `↳ links to block ${prev.id}'s hash ${block.prevHash}`}
                  {status === 'broken' && `↳ recomputed hash of block ${prev.id} is ${blockHash(prev.id, prev.txs, prev.prevHash)} ≠ stored ${block.prevHash} ✗`}
                  {status === 'pending' && '↳ will link once both blocks are mined'}
                </div>
              )}
              {mined && i === 0 && (
                <button type="button"
                  style={{ marginTop: 6, fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
                  onClick={() => onTamper(block.id)}
                  aria-label="Edit a transaction in this block">
                  ✏️ Edit old transaction
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.feedback} role="status">
        {broken === 0 && justMined && (
          <div>
            <p>The block&apos;s hash seals its contents. The next block stores that hash — that is the link.</p>
          </div>
        )}
        {tamperBlock === 0 && broken > 0 && (
          <div>
            <p>You edited block 0, but its stored hash no longer matches its contents.</p>
            <p>
              Every later block still references the old hash. To make the tamper stick, an attacker would
              need to re-mine <strong>every block after it</strong> — that is why on-chain data is practically immutable.
            </p>
          </div>
        )}
        {tamperBlock === 0 && broken === 0 && (
          <p>Click the edit button to change an old transaction and see what breaks.</p>
        )}
      </div>
    </section>
  );
}
