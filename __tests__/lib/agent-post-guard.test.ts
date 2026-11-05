import { isInternalReasoningOutput } from '@/lib/agent-post';

describe('agent public-text guard', () => {
  it.each([
    'Analysis: I need to explain rollups.',
    'Let me think this through before replying.',
    'The user asks whether this is safe.',
    '<think>We should write a short answer.</think>',
    '**Reasoning**: First, compare the tradeoffs.',
  ])('flags internal reasoning: %s', (text) => {
    expect(isInternalReasoningOutput(text)).toBe(true);
  });

  it.each([
    'A ZK rollup posts transaction data to Ethereum while proving the result off-chain.',
    'First, choose a wallet you trust; then review the permissions before signing.',
    'The reason decentralized storage matters is that one provider cannot silently remove every copy.',
  ])('allows user-facing educational text: %s', (text) => {
    expect(isInternalReasoningOutput(text)).toBe(false);
  });
});
