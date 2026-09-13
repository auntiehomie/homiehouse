/**
 * Knowledge-base article topics for autonomous posting.
 *
 * These are synced from rufus-vault/projects/Knowledge Base.md and provide
 * source material for the 'culture' and 'deep-dive' post modes.
 *
 * ─── SYNC INSTRUCTIONS ──────────────────────────────────────────────────────
 * When new articles are added to the Knowledge Base in rufus-vault:
 * 1. Add an entry to KB_TOPICS below with title, 1-2 sentence summary,
 *    source domain, and tags.
 * 2. The summary should be a casual one-liner — what you'd text a friend,
 *    not a formal abstract.
 * 3. Commit and redeploy. The bot automatically avoids recently-used topics.
 *
 * Last synced: 2026-09-13 from rufus-vault/projects/Knowledge Base.md
 * ────────────────────────────────────────────────────────────────────────────
 */

export interface KBTopic {
  title: string;
  summary: string;
  source: string;
  tags: string[];
}

export const KB_TOPICS: KBTopic[] = [
  {
    title: "Pentagon drones bobbing in the ocean when Starlink fails",
    summary:
      "A fleet of Pentagon drones ended up adrift in the ocean after their Starlink connection cut out mid-mission",
    source: "futurism.com",
    tags: ["tech", "military"],
  },
  {
    title: "Credit default swaps are back (the thing that blew up 2008)",
    summary:
      "The same financial product that tanked the global economy in 2008 is quietly making a comeback — synthetic CDOs and all",
    source: "newrepublic.com",
    tags: ["finance"],
  },
  {
    title: "Quantum computer stealing bitcoin in 9 minutes",
    summary:
      "Researchers showed how a sufficiently powerful quantum computer could crack Bitcoin's elliptic curve crypto and drain a wallet in under 10 minutes",
    source: "coindesk.com",
    tags: ["crypto", "quantum"],
  },
  {
    title: "Building a second brain inside VS Code",
    summary:
      "Someone ditched all their productivity apps and built their entire knowledge system inside VS Code — and never looked back",
    source: "flip.it",
    tags: ["productivity", "tools"],
  },
  {
    title: "FIP: Proof of Quality on Farcaster",
    summary:
      "A Farcaster Improvement Proposal for a reputation system based on quality signals instead of follower count or engagement farming",
    source: "github.com",
    tags: ["farcaster", "web3"],
  },
  {
    title: "Palantir employees wondering if they're the bad guys",
    summary:
      "Internal tension at Palantir as employees realize their tech is being used for mass surveillance and deportation logistics",
    source: "wired.com",
    tags: ["tech", "politics"],
  },
  {
    title:
      "Claude AI coding agent deletes entire company database in 9 seconds",
    summary:
      "A Cursor-powered Claude agent went rogue and nuked a production database — backups included — in under 10 seconds",
    source: "tomshardware.com",
    tags: ["ai", "tools"],
  },
  {
    title: "Claude is a space to think",
    summary:
      "Anthropic's essay on designing Claude as a thinking environment rather than a command-executing tool — the philosophy behind the product",
    source: "anthropic.com",
    tags: ["ai"],
  },
  {
    title: "Why TUIs are making a comeback",
    summary:
      "Terminal user interfaces are having a renaissance as devs get tired of slow Electron apps and want speed and keyboard-driven flow",
    source: "alcidesfonseca.com",
    tags: ["dev", "tools"],
  },
  {
    title: "How to deploy code with Claude Code",
    summary:
      "A practical guide to using Claude Code for CI/CD — from writing and testing to shipping real code without leaving the terminal",
    source: "towardsdatascience.com",
    tags: ["ci-cd", "ai", "tools", "automation"],
  },
  {
    title: "Apple is the King of AI and nobody knows it",
    summary:
      "Apple has been quietly shipping AI features across its ecosystem — on-device ML, Neural Engine, privacy-first approach — while everyone watches OpenAI and Google",
    source: "open.substack.com",
    tags: ["ai", "apple"],
  },
  {
    title: "Having many interests wasn't the problem",
    summary:
      "A counterargument to the \"pick one thing\" advice — being a generalist with wide curiosity isn't a flaw, it's a different operating model",
    source: "open.substack.com",
    tags: ["productivity"],
  },
  {
    title: "The Hidden Du Bois — how academia ignored a giant",
    summary:
      "A deep look at how W.E.B. Du Bois's sociological work was systematically buried by the white academic establishment for decades",
    source: "open.substack.com",
    tags: ["history"],
  },
  {
    title: "Can trustless agents be trusted? (ERC-8004)",
    summary:
      "A proposal for a decentralized AI agent ecosystem where agents operate trustlessly — but the question is whether trustlessness actually makes them trustworthy",
    source: "arxiv.org",
    tags: ["ai", "crypto", "security"],
  },
  {
    title: "The 0DTE options strategy",
    summary:
      "Zero-days-to-expiration options trading — high risk, high reward, and increasingly popular among retail traders who treat the market like a casino",
    source: "reddit.com",
    tags: ["finance", "options", "trading"],
  },
  {
    title: "A2A: the open standard for AI agents to talk to each other",
    summary:
      "The Agentic AI Foundation launched an open protocol (Agent-to-Agent) so AI agents from different companies can interoperate — like SMTP for bots",
    source: "axios.com",
    tags: ["ai", "agentic"],
  },
  {
    title: "x402: internet-native payments for AI agents",
    summary:
      "The Linux Foundation backed a standard for AI agents to pay each other over the internet — micropayments, API calls, agent-to-agent commerce",
    source: "linuxfoundation.org",
    tags: ["ai", "crypto", "payments"],
  },
  {
    title: "Hypersnap: Snapchain made hyperdimensional",
    summary:
      "The latest Farcaster hub implementation — a DAG-based consensus that speeds up sync, handles conflicts better, and scales the protocol",
    source: "github.com",
    tags: ["farcaster", "infrastructure"],
  },
  {
    title: "Billionaires terrified of Google AI genius behind 25-year-old game",
    summary:
      "A Google researcher who built a cult-classic game is now working on AGI, and Musk and Altman are reportedly spooked by how close he might be",
    source: "pcgamer.com",
    tags: ["ai", "agi", "tech"],
  },
  {
    title: "Berlin refuses to pay hackers who stole city data",
    summary:
      "Hackers breached Berlin's state network, stole data, and demanded a ransom — the city said no, and now the data is getting dumped",
    source: "thehackernews.com",
    tags: ["cybersecurity", "ransomware"],
  },
  {
    title: "$5.7M six-chain hack — Cosmos Labs wrongly cleared the bug",
    summary:
      "A bug that Cosmos Labs had reviewed and dismissed as safe ended up being exploited across six chains for $5.7 million",
    source: "theblock.co",
    tags: ["crypto", "security", "defi"],
  },
  {
    title: "Nate Silver and the art of forecasting",
    summary:
      "The data journalist who called elections with uncanny accuracy — his philosophy on probability, uncertainty, and why most pundits are just guessing",
    source: "wikipedia.org",
    tags: ["statistics", "forecasting", "politics"],
  },
  {
    title: "Attackers steal METR API key and burn $600K in AI credits",
    summary:
      "Someone swiped an API key from AI safety org METR and ran up a $600,000 bill on AI compute before it was caught",
    source: "thehackernews.com",
    tags: ["cybersecurity", "ai"],
  },
  {
    title: "OpenAI Astra can discover zero-day vulnerabilities",
    summary:
      "OpenAI's new Astra model can autonomously find and exploit zero-day security flaws — the kind of thing that usually takes human researchers weeks",
    source: "cybersecuritynews.com",
    tags: ["ai", "cybersecurity"],
  },
  {
    title: "US charges Russian for infecting 80,000 freelancers with malware",
    summary:
      "A Russian national allegedly distributed malware disguised as freelance job offers, compromising 80,000 people's devices for espionage",
    source: "bleepingcomputer.com",
    tags: ["cybersecurity", "crime"],
  },
  {
    title: "Iowa drops charges against security testers hired to break in",
    summary:
      "Two pentesters were hired by a court to test physical security, did their job, then got arrested for it — prosecutors finally dropped the case",
    source: "krebsonsecurity.com",
    tags: ["cybersecurity", "legal"],
  },
];

/**
 * Pick a KB topic that hasn't been used recently.
 *
 * Same pattern as pickFreshTopic — avoids `recentTopics` (from the agent's
 * memory of titles/topics used in recent posts), falling back to any topic
 * only if all 26 have been used lately.
 */
export function pickKBTopic(recentTopics: string[] = []): KBTopic {
  const used = new Set(
    recentTopics.map((t) => (t || "").toLowerCase().trim()).filter(Boolean),
  );
  const fresh = KB_TOPICS.filter((t) => !used.has(t.title.toLowerCase()));
  const pool = fresh.length ? fresh : KB_TOPICS;
  return pool[Math.floor(Math.random() * pool.length)];
}
