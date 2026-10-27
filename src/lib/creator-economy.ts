import type { LearningModule } from './kb-curriculum';

/** Narrow topic signals: Base alone can mean infrastructure, not creator economics. */
export function isCreatorEconomyTopic(text: string): boolean {
  return /\b(creator economy|creator coins?|content coins?|post coins?|basecoins|zora|base app)\b/i.test(text);
}

export const CREATOR_ECONOMY_CONTEXT = `
Creator economy reading notes, checked 2026-10-25:
- https://nft-docs.zora.co/ explicitly labels itself legacy NFT documentation and points to https://docs.zora.co/coins for modern Coins docs. Teach the NFT-to-fungible-coin transition, not Ethereum development as the main curriculum.
- https://docs.zora.co/coins distinguishes profile-level Creator Coins from post-level Content Coins and Trend Coins. Creator Coins have 1 billion supply, half market allocation and half creator allocation vesting over five years. Content Coins have a different allocation. Do not conflate these with the ZORA token, Base network, or Zora Network.
- https://docs.zora.co/coins/contracts/rewards documents a trading fee split between several recipients. The total trading fee is NOT all creator income. Current docs and older help pages differ; identify protocol version and date rather than repeating a universal creator reward percentage.
- https://www.base.org/blog/a-new-day-one describes the 2025 Base App launch vision: a social feed with Zora-powered tradable posts, plus a separate weekly creator rewards program. This is historical launch context, not evidence that those features remain available today.
- https://0x.org/case-studies/zora describes routing between post coins, creator coins and ZORA. The integration provider explains mechanics and its own product benefits; its promotional framing is not independent proof of durable creator income.
- https://www.galaxy.com/insights/research/coinbase-capitulates-on-creator-coins-in-base-team-shakeup (July 17, 2026) reports the retreat from content coins and analyzes fragmented attention and short speculative cycles. Attribute its assessment to Galaxy; do not infer that every creator coin, Zora, or the creator economy ceased to exist. Historical Coinbase help pages still describe weekly rewards, so do not present archived launch features as current earning opportunities.
Curriculum scope: creator livelihoods, NFTs versus fungible profile/post coins, Base App distribution, the Base content-coin moment (including Base is for everyone), the rise and setbacks of creator coins, and alternatives such as subscriptions, commissions and memberships. Here “basecoins” means the learner's Base creator/content-coin moment, not the unrelated historical Basecoin stablecoin project or an official Base token.
Teach creator earnings separately from holder returns; volume and token price are not creator revenue or audience retention. Use dated, attributed evidence for historical outcomes. Never invent crash percentages, prices, causal claims or holder rights. Buying a coin does not by itself establish copyright, equity, revenue sharing or access rights. All exercises must work without buying, minting or trading.
`;

const topics = [
  ['creator-economy-foundations', 'The Creator Economy: Who Gets Paid?', 'Compare advertising, subscriptions, commissions, NFT sales and trading-fee income. Follow the money from audience to creator.', ['Distinguish creator revenue from token-holder returns', 'Compare recurring income with speculative trading activity']],
  ['creator-zora-nfts-to-coins', 'Zora: From NFT Collecting to Creator and Content Coins', 'Understand the shift from collectible NFTs to fungible tokens attached to profiles and posts, and distinguish both from ZORA.', ['Distinguish an NFT, profile coin, post coin and protocol token', 'Explain supply, vesting and trading-fee recipients using dated docs']],
  ['creator-base-app-moment', 'Base App and the Content-Coin Moment', 'Explore the social trading launch vision, Zora distribution and the Base is for everyone case, separating a content coin from the network itself.', ['Explain why distribution mattered to the experiment', 'Separate the historical weekly rewards program from protocol trading fees']],
  ['creator-coins-rise-and-setbacks', 'Creator Coins: The Rise, Setbacks and Platform Pivot', 'Compare the promise of direct creator monetization with the reported retreat from content coins. Examine what failed without declaring all creator businesses failures.', ['Build a dated timeline with attributed sources', 'Separate documented events, reported explanations and unresolved questions']],
  ['creator-coin-incentives', 'When Attention Becomes a Market', 'Explore thin liquidity, selling pressure, vesting, fee incentives and the difference between a valuable audience and a rising chart.', ['Explain why creators can earn fees while holders lose money', 'Distinguish market cap, liquidity, trading volume and realized revenue']],
  ['creator-sustainable-income', 'What Makes Creator Income Sustainable?', 'Design a creator business that compares coins with subscriptions, memberships and commissions. Evaluate consent, rights and dependence on platform subsidies.', ['Compare income after costs and incentives', 'Design a no-spend experiment measuring retention and repeat support']],
] as const;

export function creatorEconomyModules(level: string): LearningModule[] {
  return topics.map(([id, title, description, objectives], index) => ({
    id, title, description, objectives: [...objectives],
    whyItMatters: 'Understand the creator business and its incentives before treating attention or token prices as sustainable income.',
    estimatedMinutes: level === 'advanced' ? 30 : 20,
    difficulty: level === 'advanced' ? 'advanced' : level === 'intermediate' || index > 2 ? 'intermediate' : 'beginner',
    tags: ['creator', 'creator-economy', 'zora', 'content-coins'],
  }));
}
