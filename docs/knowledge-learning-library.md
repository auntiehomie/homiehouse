# Knowledge-backed learning library

Reviewed October 25, 2026. Nine authored courses extend the existing safety and balanced Network State curricula: Bitcoin, Ethereum, decentralization, DAOs, AI agents and paid tools, NFTs, creator coins, reading Bankless critically, and privacy crypto.

The public `/learn/library` catalog combines topic and difficulty filters. Each course has source links, an original fictional exercise, and understanding checks. The interactive start uses the existing lesson player and extends server-side assignments without deleting earned or in-progress modules.

## Hybrid generation

AI generation remains enabled. `reading-grounding.ts` matches specific terms against reviewed courses and supplies attributed context to all three paths:

- Cast-derived learning-plan generation.
- `/api/lesson` personalized or cast-derived generation.
- Ask Homie's conversation explanation/lesson generator.

The generator combines those notes with runtime Rufus-vault summaries and the selected cast/thread. A database failure leaves reviewed background available. Casts remain untrusted claims; they are not promoted to facts. The prompt requires source URLs, dates, limitations, and relevant counterarguments. A cast-specific request does not short-circuit to a fixed course even when its module ID matches one, and bypasses the shared lesson cache. Without an AI provider, cast generation continues to report unavailability instead of substituting a generic lesson.

Authored courses intentionally avoid model calls. Direct course access and personalized synthesis are distinct entry paths using the same source material.

## Sources and scope

The existing Rufus-vault Bitcoin and Ethereum whitepapers and x402 introduction are reused. Twelve additional index/context notes cover Buterin's decentralization/DAO/voting writings; Anthropic's agent design essay; Ethereum.org NFTs; Zora's Coins introduction; Bankless About, Disclosures and creator-economy analysis; Monero's FAQ; Z.cash's shielded/transparent explainer; and the abstract of Kappos et al.'s 2018 Zcash study.

Source labels and notes preserve historical dates, living-document status, partial review, and abstract-only scope. Project documentation is not treated as independent outcome evidence. Bankless is an attributed perspective with disclosed incentives. No inaccessible podcast audio or blocked article was summarized.

## Validation

Focused Jest coverage checks direct course delivery, cast-specific AI calls, grounding when the DB is unavailable, precise term matching, and existing KB/network-state behavior. Production browser coverage checks topic plus difficulty filtering, source navigation, interactive plan creation, and layout at 390px and 1280px. Live provider quality and authenticated production rewards require deployment credentials and are not established by mocked provider tests.
