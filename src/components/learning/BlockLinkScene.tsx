'use client';

import { useEffect, useRef, useState } from 'react';
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

const SCRAMBLE_CHARS = '0123456789abcdef';

/**
 * Interactive scene for the blockchain-basics concept "what a block contains
 * and how blocks link together". The learner fills a block with transactions,
 * mines it, then tries to edit an old transaction — and watches the hash links
 * break, which IS the explanation for why on-chain data is practically
 * immutable. No replica of Brilliant/Duolingo; the interaction is derived
 * directly from the module concept.
 *
 * Motion design (reduced-motion safe):
 * - transactions pop into the pending block one at a time (staggered pop-in)
 * - mining seals the block with a scramble-then-settle hash animation, so the
 *   learner watches the hash get "computed"
 * - intact links breathe with a traveling pulse; pending links are dashed
 * - tampering sends a red ripple DOWN the chain: each broken link flips with a
 *   delay proportional to its distance from the edited block, so the damage
 *   visibly propagates instead of just appearing
 */
export default function BlockLinkScene() {
  const [chain, setChain] = useState<BlockChainBlock[]>(freshChain);
  const [txCursor, setTxCursor] = useState(0);
  const [tamperBlock, setTamperBlock] = useState<number | null>(null);
  const [sealedId, setSealedId] = useState<number | null>(null);
  const [scramble, setScramble] = useState<{ id: number; text: string } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const pending = chain[chain.length - 1];
  const broken = brokenLinkCount(chain);

  function onAdd() {
    setSealedId(null);
    setChain((c) => addTx(c, TX_POOL[txCursor % TX_POOL.length]));
    setTxCursor((i) => i + 1);
  }

  function onMine() {
    const sealed = pending.id;
    const finalHash = blockHash(sealed, pending.txs, chain[chain.length - 2].hash);
    setSealedId(sealed);
    // Presentation-only scramble: the hash "computes" over ~650ms, left to
    // right, then settles on the real value. State always holds the real hash.
    const frames = 8;
    for (let f = 1; f <= frames; f++) {
      timers.current.push(setTimeout(() => {
        setScramble(() => {
          if (f === frames) return null;
          const text = finalHash.split('').map((ch, i) =>
            i < (f / frames) * finalHash.length ? ch : SCRAMBLE_CHARS[Math.floor(Math.random() * 16)]
          ).join('');
          return { id: sealed, text };
        });
      }, (f / frames) * 650));
    }
    setChain((c) => minePending(c));
  }

  function onTamper(blockId: number) {
    setSealedId(null);
    setScramble(null);
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
        <button type="button" onClick={() => { setChain(freshChain()); setTamperBlock(null); setSealedId(null); setScramble(null); }}>
          Reset chain
        </button>
      </div>

      <ol className="hh-blockchain" aria-label="Blocks in the chain">
        <style>{`
          .hh-blockchain { list-style: none; display: flex; flex-direction: column; gap: 0; padding: 0; margin: .75rem 0 0; }
          .hh-block { position: relative; border: 1px solid rgba(148,163,184,.35); border-radius: 12px; padding: 10px 12px 8px; background: rgba(148,163,184,.07); }
          .hh-block[data-mined='false'] { border-style: dashed; opacity: .8; }
          .hh-block[data-sealed='true'] { animation: hhSealSweep .7s ease-out; }
          .hh-block[data-broken='true'] { border-color: rgba(239,68,68,.8); background: rgba(239,68,68,.08); animation: hhSealSweep .7s ease-out, hhBlockShake .45s ease-in-out .25s; }
          .hh-block-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
          .hh-block-tag { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; }
          .hh-block[data-broken='true'] .hh-block-tag { color: #f87171; }
          .hh-hash-chip { margin-left: auto; font-size: 11px; padding: 3px 8px; border-radius: 999px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: rgba(52,211,153,.12); color: #34d399; border: 1px solid rgba(52,211,153,.35); }
          .hh-hash-chip[data-scrambling='true'] { background: rgba(250,204,21,.12); color: #facc15; border-color: rgba(250,204,21,.4); }
          .hh-block[data-broken='true'] .hh-hash-chip { background: rgba(239,68,68,.14); color: #f87171; border-color: rgba(239,68,68,.5); text-decoration: line-through; }
          .hh-tx { display: inline-block; font-size: 13px; padding: 3px 8px; margin: 2px 4px 2px 0; border-radius: 8px; background: rgba(255,255,255,.07); animation: hhTxPop .35s cubic-bezier(.34,1.56,.64,1) backwards; }
          .hh-tx[data-tampered='true'] { background: rgba(239,68,68,.18); color: #fca5a5; border: 1px dashed rgba(239,68,68,.6); }
          .hh-link { position: relative; display: flex; align-items: center; gap: 8px; margin: 0; padding: 6px 0 6px 30px; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; min-height: 30px; }
          .hh-link::before { content: ''; position: absolute; left: 12px; top: 0; bottom: 0; width: 3px; border-radius: 2px; background: #34d399; background-size: 100% 300%; }
          .hh-link[data-status='ok'] { color: #86efac; }
          .hh-link[data-status='ok']::before { animation: hhPulseDown 2.4s linear infinite; }
          .hh-link[data-status='broken'] { color: #f87171; }
          .hh-link[data-status='broken']::before { background: #ef4444; }
          .hh-link[data-status='pending'] { color: #facc15; }
          .hh-link[data-status='pending']::before { background: repeating-linear-gradient(180deg, #facc15 0 4px, transparent 4px 8px); }
          .hh-ripple { opacity: 0; }
          .hh-link[data-status='ok'] .hh-ripple { opacity: 1; }
          .hh-link[data-status='broken'] .hh-ripple { opacity: 1; animation: hhRippleIn .5s ease-out backwards; }
          @keyframes hhTxPop { 0% { transform: scale(.4) translateY(8px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
          @keyframes hhSealSweep { 0% { box-shadow: inset 0 0 0 0 rgba(52,211,153,.5); } 100% { box-shadow: inset 0 0 0 24px rgba(52,211,153,0); } }
          @keyframes hhBlockShake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-2px); } 80% { transform: translateX(2px); } }
          @keyframes hhPulseDown { 0% { background-position: 0 -300%; } 100% { background-position: 0 300%; } }
          @keyframes hhRippleIn { 0% { transform: scale(.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
          @media (prefers-reduced-motion: reduce) {
            .hh-tx, .hh-block, .hh-link::before, .hh-ripple { animation: none !important; }
          }
        `}</style>
        {chain.map((block, i) => {
          const mined = isMined(block);
          const prev = chain[i - 1];
          const status = linkStatus(prev, block);
          const sealed = sealedId === block.id && mined;
          const blockBroken = broken > 0 && (tamperBlock === block.id || status === 'broken');
          const shownHash = scramble?.id === block.id ? scramble.text : block.hash;
          const tamperedHere = tamperBlock === block.id && broken > 0;
          // The tamper ripple delays each broken link proportional to its
          // distance from the edited block, so damage spreads down the chain.
          const rippleDelay = status === 'broken' ? `${Math.min(i, 5) * 0.28}s` : undefined;
          return (
            <li key={block.id} className="hh-block" data-mined={mined} data-sealed={sealed} data-broken={blockBroken}>
              <div className="hh-block-header">
                <span className="hh-block-tag">
                  {blockBroken ? '✗ tampered' : `Block ${block.id}`} {mined ? '' : '· pending'}
                </span>
                {mined && (
                  <span className="hh-hash-chip" data-scrambling={scramble?.id === block.id} aria-label={`hash of block ${block.id}`}>
                    {shownHash || 'unmined'}
                  </span>
                )}
              </div>
              {block.txs.length === 0 && (
                <span style={{ fontSize: 12, opacity: .55 }}>{mined ? '(empty)' : 'no transactions yet'}</span>
              )}
              {block.txs.map((tx, ti) => (
                <span key={ti} className="hh-tx" data-tampered={tamperedHere && ti === 0} style={{ animationDelay: `${ti * 70}ms` }}>
                  {tx}{!mined && <em style={{ opacity: .6 }}> ·unconfirmed</em>}
                </span>
              ))}
              {i > 0 && (
                <div className="hh-link" data-status={status}>
                  <span className="hh-ripple" style={status === 'broken' ? { animationDelay: rippleDelay } : undefined}>
                    {status === 'ok' && `✓ links to block ${prev.id} hash ${block.prevHash}`}
                    {status === 'broken' && `✗ recomputed ${blockHash(prev.id, prev.txs, prev.prevHash)} ≠ stored ${block.prevHash}`}
                    {status === 'pending' && '… will link once both blocks are mined'}
                  </span>
                </div>
              )}
              {mined && i === 0 && (
                <button type="button"
                  style={{ marginTop: 8, fontSize: 12, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(148,163,184,.4)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
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
        {broken === 0 && sealedId !== null && (
          <div>
            <p>The block&apos;s hash seals its contents — the next block stores that hash. That is the link.</p>
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
