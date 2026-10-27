# HH2 community rewards and tipping design

## Current implementation

- Learning module completions, daily challenges, and streak bonuses create off-chain HH2 reward events. The learner claims eligible rewards to a connected Base wallet.
- The feed now offers a `💲 Tip` action. A sender must connect an EVM wallet, choose an amount, and confirm an ERC-20 transfer in that wallet. The app resolves only the recipient's verified Ethereum address from their profile. This is a direct wallet-to-wallet transfer; it does not use or spend a Homiehouse treasury.
- The feed uses OpenRank's global engagement score for spam filtering. That score is a network reputation signal, not an assessment of whether a cast is educational, original, or accurate.
- Automatic bot-funded quality tips are not enabled. The existing claim endpoint uses a server-side treasury signer to pay user-claimed learning rewards, but there is no community-reward budget, scoring pipeline, per-author cap, or appeal policy wired into it.

## Proposed bot-funded quality tips

Keep author reputation, cast quality, and reward eligibility as separate steps. EigenTrust can help identify whether an author is trusted by a broader graph; it cannot grade a particular post. OpenRank describes its Farcaster scores as EigenTrust rankings over social-graph actions such as follows, recasts, mentions, and comments. Treat this score as one eligibility signal and never as a quality verdict.

### 1. Select eligible original casts

- Limit candidates to original casts in crypto, AI, decentralization, privacy, or technology. Exclude recasts, duplicate text, replies that add no substantive context, and casts already evaluated or rewarded.
- Resolve the author to a FID and require a linked, verified Base address before any token award.
- Use available user cast history to estimate observed account tenure and the author's original-cast share. Do not treat the oldest cast fetched as the account creation date; it is only an observed-history lower bound.
- Do not pay more for longer text. A brief, clear explanation may be better than a long post. Use length only to establish that the post contains enough context to assess.

### 2. Grade the cast on an explicit rubric

Use a bounded structured review with a fixed rubric, not raw engagement counts. Suggested criteria, each scored 0–2 with a short evidence note:

1. **Educational value:** explains a useful concept or teaches a reader how to reason about it.
2. **Accuracy and support:** distinguishes evidence from opinion; cites or identifies checkable sources for factual claims.
3. **Clarity and context:** defines specialized terms, explains assumptions, and can be understood without insider knowledge.
4. **Reasoning and balance:** offers a coherent explanation, acknowledges material uncertainty, and avoids presenting disputed claims as settled fact.
5. **Original contribution:** adds the author's own synthesis or example rather than repeating a copied post or slogan.

Require a minimum total and a passing score in accuracy/support. Reject unsupported medical, financial, or legal claims; deceptive promotion; impersonation; copied content; and content that merely gets high engagement. Model scoring should be advisory, cite the exact cast spans it relied on, and be sampled for human review before token disbursement.

### 3. Apply reputation and anti-gaming gates

- Use OpenRank's current global engagement EigenTrust score as one independent gate, with a neutral path for new or unranked authors rather than silently assigning them a low quality score.
- Use observed tenure and original-cast share as additional identity/history evidence. Neither is proof of authenticity. Do not count follower totals, recasts, or likes as proof of educational quality.
- Have a separate high-reputation review path for cases where the cast rubric passes but EigenTrust data is unavailable. Fail closed for payment if recipient identity, duplicate status, or the scorer result is unresolved.
- Store scorer version, rubric scores, evidence notes, OpenRank value and retrieval time, history sample size/span, duplicate key, reward amount, and reviewer/appeal outcome for every decision.

### 4. Put limits before funding

Before enabling bot payouts, set a funded reward budget, daily and monthly spend caps, per-author caps, a minimum payout threshold, a duplicate window, and an emergency pause. Run a shadow period first: score candidates and show the proposed rewards without transferring tokens. Review false positives, missed newcomers, sybil patterns, and concentration before activating a signer.

For live payout, reuse the existing user-claimed reward flow only after it has a separate community budget, per-author caps, and auditable reward records; otherwise use a dedicated, limited treasury signer. Never use a user's wallet or the token contract owner key for routine bot rewards. Require a recipient opt-in and verified wallet, and make the reward amount and transaction visible before claim. Include a simple appeal path for rejected or mis-scored casts.

## Direct `💲` tips

The feed's `💲 Tip` control is a direct transfer rather than a Farcaster reaction convention: the sender chooses an HH2 amount and signs `transfer(verifiedRecipient, amount)` on Base. This keeps control with the sender and avoids any server-held spending key. The UI warns that transfers are generally irreversible and links the submitted transaction to Basescan.

The button requires the cast author to have a verified Ethereum address. A future FID-to-wallet resolver could support people without one, but it must verify ownership and let recipients choose their receiving address before tipping. Do not silently route tips to custody addresses.

## Source notes

- OpenRank Farcaster integration and its EigenTrust use: <https://docs.openrank.com/integrations/farcaster>
- OpenRank Farcaster ranking strategies: <https://docs.openrank.com/integrations/farcaster/ranking-strategies-on-farcaster>
- Original EigenTrust paper: <https://nlp.stanford.edu/pubs/eigentrust.pdf>
