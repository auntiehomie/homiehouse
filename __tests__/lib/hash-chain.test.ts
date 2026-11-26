import {
  addTx,
  blockHash,
  brokenLinkCount,
  freshChain,
  isMined,
  linkStatus,
  minePending,
  tamperTx,
} from '@/lib/hash-chain';

describe('hash-chain lesson logic', () => {
  it('seals each mined block with a hash that covers its contents and predecessor', () => {
    let chain = freshChain();
    chain = addTx(chain, 'Alice sends Bob 5 HH2');
    chain = minePending(chain);
    chain = addTx(chain, 'Bob sends Carol 2 HH2');
    chain = minePending(chain);
    const mined = chain[chain.length - 2];
    expect(isMined(mined)).toBe(true);
    expect(mined.hash).toBe(blockHash(mined.id, mined.txs, chain[chain.length - 3].hash));
  });

  it('links each new block to the previous block hash', () => {
    let chain = freshChain();
    chain = minePending(addTx(chain, 'Bob sends Carol 2 HH2'));
    const prev = chain[chain.length - 3];
    const next = chain[chain.length - 2];
    expect(linkStatus(prev, next)).toBe('ok');
  });

  it('marks unmined links as pending, never broken', () => {
    const chain = freshChain();
    expect(linkStatus(chain[0], chain[1])).toBe('pending');
  });

  it('breaks the link after a block whose transaction was edited without re-mining', () => {
    let chain = freshChain();
    chain = minePending(addTx(chain, 'Bob sends Carol 2 HH2'));
    chain = minePending(addTx(chain, 'Dave sends Alice 1 HH2'));
    expect(brokenLinkCount(chain)).toBe(0);
    // Tamper with block 0's transaction; its stored hash becomes stale.
    chain = tamperTx(chain, 0, 0, 'Alice sends Bob 999 HH2');
    expect(chain[0].txs[0]).toBe('Alice sends Bob 999 HH2');
    expect(brokenLinkCount(chain)).toBeGreaterThan(0);
    expect(linkStatus(chain[0], chain[1])).toBe('broken');
  });

  it('caps blocks at three transactions and ignores empty ones', () => {
    let chain = freshChain();
    chain = addTx(chain, 'a');
    chain = addTx(chain, '');
    chain = addTx(chain, 'b');
    chain = addTx(chain, 'c');
    chain = addTx(chain, 'd'); // 4th tx must be rejected (cap = 3)
    const pending = chain[chain.length - 1];
    expect(pending.txs).toEqual(['a', 'b', 'c']);
  });

  it('rejects tampering with a nonexistent block or transaction', () => {
    const chain = freshChain();
    expect(tamperTx(chain, 5, 0, 'nope')[0].txs).toEqual(chain[0].txs);
    expect(tamperTx(chain, 0, 7, 'nope')[0].txs).toEqual(chain[0].txs);
  });

  it('produces deterministic hashes for identical content', () => {
    expect(blockHash(1, ['a', 'b'], 'deadbeef')).toBe(blockHash(1, ['a', 'b'], 'deadbeef'));
    expect(blockHash(1, ['a', 'b'], 'deadbeef')).not.toBe(blockHash(1, ['a', 'c'], 'deadbeef'));
  });
});
