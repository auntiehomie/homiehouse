import type { CuratedLesson } from './safety-curriculum';

/** Source-reviewed readings; exercises are original fictional scenarios. */
export const KNOWLEDGE_LIBRARY_CURRICULUM: CuratedLesson[] = [
  {
    "module": {
      "id": "bitcoin-trust-and-payments",
      "title": "Bitcoin: What Replaces the Payment Middleman?",
      "description": "Understand double spending, proof of work, and why a public ledger does not make every user anonymous.",
      "whyItMatters": "Understand double spending, proof of work, and why a public ledger does not make every user anonymous.",
      "objectives": [
        "Explain double spending",
        "Distinguish confirmation from certainty",
        "Question anonymity claims"
      ],
      "estimatedMinutes": 10,
      "difficulty": "beginner",
      "tags": [
        "bitcoin",
        "crypto",
        "finance",
        "knowledge-library"
      ]
    },
    "intro": "Understand double spending, proof of work, and why a public ledger does not make every user anonymous. Read the linked sources, then try the fictional exercise before checking your understanding.",
    "concepts": [
      {
        "title": "Explain double spending",
        "explanation": "Satoshi’s paper combines signatures with a proof-of-work transaction history to prevent the same funds being spent twice. Its security argument assumes honest participants control more computing power than cooperating attackers. A signature alone does not establish which conflicting payment came first."
      },
      {
        "title": "Distinguish confirmation from certainty",
        "explanation": "The paper models an attacker catching up as blocks accumulate. Confirmation reduces modeled reversal risk under its assumptions; it is not a promise that every transaction is instantly irreversible."
      },
      {
        "title": "Question anonymity claims",
        "explanation": "Section 10 acknowledges transaction-linking risks. Public keys can be separate from names while the transaction history remains public. Classroom question: what extra information would let an observer connect a donation address to a person?"
      }
    ],
    "practicalExample": "Fictional exercise: A club receives two conflicting payment promises for the same funds. Explain what a signature proves and what transaction ordering must resolve. Then list what remains visible if the club publishes its donation address.",
    "quickActions": [
      "Read the abstract and sections 2–5",
      "Read section 10 on privacy",
      "Write a two-sentence explanation without using the word trustless"
    ],
    "summary": "Explain the mechanism, identify who still has power, and name one limitation before judging the claim.",
    "quiz": [
      {
        "question": "What must transaction ordering help prevent?",
        "options": [
          "Double spending",
          "A falling market price",
          "Every lost password",
          "All merchant disputes"
        ],
        "correctIndex": 0,
        "explanation": "Ordering addresses conflicting spends; it does not solve every payment problem."
      },
      {
        "question": "Does a signature alone settle which conflicting spend came first?",
        "options": [
          "Always",
          "Only if the amount is small",
          "No",
          "Only for new wallets"
        ],
        "correctIndex": 2,
        "explanation": "Authorization and shared ordering are different problems."
      },
      {
        "question": "What does a nameless address guarantee?",
        "options": [
          "No one can ever identify its owner",
          "All transfers are hidden",
          "A refund",
          "None of these"
        ],
        "correctIndex": 3,
        "explanation": "A public history may become associated with an identity."
      }
    ],
    "sources": [
      {
        "label": "Satoshi Nakamoto: Bitcoin whitepaper (2008; existing KB)",
        "url": "https://bitcoin.org/bitcoin.pdf"
      }
    ]
  },
  {
    "module": {
      "id": "ethereum-programmable-rules",
      "title": "Ethereum: Shared Rules, Real Dependencies",
      "description": "Learn the original smart-contract idea and separate programmable enforcement from trustworthy real-world information.",
      "whyItMatters": "Learn the original smart-contract idea and separate programmable enforcement from trustworthy real-world information.",
      "objectives": [
        "Explain programmable state",
        "Find the boundary of a rule",
        "Test the claim before generalizing"
      ],
      "estimatedMinutes": 10,
      "difficulty": "beginner",
      "tags": [
        "ethereum",
        "smart-contract",
        "decentralization",
        "knowledge-library"
      ]
    },
    "intro": "Learn the original smart-contract idea and separate programmable enforcement from trustworthy real-world information. Read the linked sources, then try the fictional exercise before checking your understanding.",
    "concepts": [
      {
        "title": "Explain programmable state",
        "explanation": "The 2014 Ethereum whitepaper proposes a general-purpose platform where contracts encode rules for changing shared state. It is a historical vision, not the specification of today’s Ethereum."
      },
      {
        "title": "Find the boundary of a rule",
        "explanation": "Original exercise: a contract releases a workshop deposit when a delivery is confirmed. Code can check a submitted value, but ask who supplies that value, who can change the rule, and who handles a mistake."
      },
      {
        "title": "Test the claim before generalizing",
        "explanation": "Write two distinct questions: does the program execute its stated rule, and does that rule serve the people affected? Passing the first test does not settle the second. Compare an automated payment with a decision requiring judgment."
      }
    ],
    "practicalExample": "Fictional exercise: Write deposit-release rules for a repair workshop. Specify the delivery witness, a dispute deadline, and the person responsible if the witness is unavailable.",
    "quickActions": [
      "Read the whitepaper introduction",
      "Underline every outside dependency in your exercise",
      "Compare your design with an ordinary shared spreadsheet"
    ],
    "summary": "Explain the mechanism, identify who still has power, and name one limitation before judging the claim.",
    "quiz": [
      {
        "question": "How should the 2014 whitepaper be used?",
        "options": [
          "As today’s complete specification",
          "As a historical design document",
          "As a profit forecast",
          "As an audit of every app"
        ],
        "correctIndex": 1,
        "explanation": "The site explicitly warns that the original paper does not describe today’s entire system."
      },
      {
        "question": "Which question tests an outside dependency?",
        "options": [
          "What color is the button?",
          "How many likes did the announcement get?",
          "Who reports that delivery occurred?",
          "Is the title catchy?"
        ],
        "correctIndex": 2,
        "explanation": "Delivery information comes from outside the program."
      },
      {
        "question": "What does correct execution establish?",
        "options": [
          "The encoded rule was followed",
          "The rule is fair to everyone",
          "The input is always true",
          "No dispute can arise"
        ],
        "correctIndex": 0,
        "explanation": "Execution and the quality of rules or inputs are separate evaluations."
      }
    ],
    "sources": [
      {
        "label": "Vitalik Buterin: Ethereum whitepaper (2014; historical, existing KB)",
        "url": "https://ethereum.org/whitepaper/"
      }
    ]
  },
  {
    "module": {
      "id": "decentralization-power-map",
      "title": "Decentralization: Draw the Power Map",
      "description": "Evaluate infrastructure, control, and shared state instead of treating decentralization as a yes-or-no badge.",
      "whyItMatters": "Evaluate infrastructure, control, and shared state instead of treating decentralization as a yes-or-no badge.",
      "objectives": [
        "Separate three dimensions",
        "Count independent decisions",
        "Look beyond the protocol"
      ],
      "estimatedMinutes": 15,
      "difficulty": "intermediate",
      "tags": [
        "decentralization",
        "decentralized-social",
        "governance",
        "knowledge-library"
      ]
    },
    "intro": "Evaluate infrastructure, control, and shared state instead of treating decentralization as a yes-or-no badge. Read the linked sources, then try the fictional exercise before checking your understanding.",
    "concepts": [
      {
        "title": "Separate three dimensions",
        "explanation": "Buterin’s 2017 essay distinguishes architectural decentralization (computers and failure tolerance), political decentralization (who controls them), and logical decentralization (one shared system or independently functioning parts). These dimensions can differ."
      },
      {
        "title": "Count independent decisions",
        "explanation": "Original exercise: ten servers belong to one operator. Compare that arrangement with three independently operated servers. A server count alone does not answer who can change access rules or stop service."
      },
      {
        "title": "Look beyond the protocol",
        "explanation": "For a fictional social app, list the login provider, indexing service, client, and storage operator. Mark which replacement paths you have actually tested. Treat each untested fallback as an assumption, then choose one to investigate."
      }
    ],
    "practicalExample": "Fictional exercise: A community wants to call its app decentralized because it uses a blockchain. Draw the services required to sign in, read, and post. Circle every operator that can interrupt the experience.",
    "quickActions": [
      "Read the essay’s three-axis framework",
      "Identify one independent operator and one shared dependency",
      "Write a narrower claim that your evidence supports"
    ],
    "summary": "Explain the mechanism, identify who still has power, and name one limitation before judging the claim.",
    "quiz": [
      {
        "question": "Ten servers owned by one company establish what?",
        "options": [
          "Ten independent governing bodies",
          "A server count, not independent control",
          "Automatic privacy",
          "Guaranteed portability"
        ],
        "correctIndex": 1,
        "explanation": "Infrastructure quantity does not determine independent control."
      },
      {
        "question": "Which dimension asks who controls computers?",
        "options": [
          "Logical",
          "Geographic",
          "Political",
          "Visual"
        ],
        "correctIndex": 2,
        "explanation": "Political decentralization concerns controlling people or organizations."
      },
      {
        "question": "Which is the strongest fallback evidence?",
        "options": [
          "An announcement",
          "A logo",
          "A promise",
          "A successful replacement-path test"
        ],
        "correctIndex": 3,
        "explanation": "Observed replacement behavior is stronger evidence than an untested claim."
      }
    ],
    "sources": [
      {
        "label": "Vitalik Buterin: The Meaning of Decentralization (2017)",
        "url": "https://medium.com/@VitalikButerin/the-meaning-of-decentralization-a0c92b76a274"
      }
    ]
  },
  {
    "module": {
      "id": "dao-voting-and-accountability",
      "title": "DAOs: Voting Is Only Part of Governance",
      "description": "Compare the case for decentralized organizations with the risks of wealth-weighted voting and unchecked execution.",
      "whyItMatters": "Compare the case for decentralized organizations with the risks of wealth-weighted voting and unchecked execution.",
      "objectives": [
        "Explain the case for a DAO",
        "Challenge coin voting",
        "Follow a decision through execution"
      ],
      "estimatedMinutes": 15,
      "difficulty": "intermediate",
      "tags": [
        "dao",
        "governance",
        "decentralization",
        "knowledge-library"
      ]
    },
    "intro": "Compare the case for decentralized organizations with the risks of wealth-weighted voting and unchecked execution. Read the linked sources, then try the fictional exercise before checking your understanding.",
    "concepts": [
      {
        "title": "Explain the case for a DAO",
        "explanation": "In his 2022 essay, Buterin argues that plural decision-making, censorship resistance, and credible fairness can justify decentralization. He also allows focused teams within a broader organization. This is a design argument, not evidence that every DAO performs better."
      },
      {
        "title": "Challenge coin voting",
        "explanation": "His 2021 critique highlights wealthy-holder dominance, neglected non-holder interests, and vote buying. Delegation may help participation but does not automatically solve every incentive problem."
      },
      {
        "title": "Follow a decision through execution",
        "explanation": "Original exercise: separate proposal, debate, vote, treasury authorization, payment, and appeal. Assign an accountable role to each. Ask what happens when a popular vote conflicts with a safety limit or a commitment to people without tokens."
      }
    ],
    "practicalExample": "Fictional exercise: A fictional learning collective funds two courses. Compare one-token-one-vote with member voting and delegated review. Explain whose voice each design misses and who can actually authorize the treasury payment.",
    "quickActions": [
      "Read the DAO argument and coin-voting critique together",
      "Write a treasury spending limit and review procedure",
      "Name one affected group that holds no governance tokens"
    ],
    "summary": "Explain the mechanism, identify who still has power, and name one limitation before judging the claim.",
    "quiz": [
      {
        "question": "What does a governance token alone establish?",
        "options": [
          "Equal influence for everyone",
          "A right defined by that system’s rules",
          "No need for accountability",
          "Perfect execution"
        ],
        "correctIndex": 1,
        "explanation": "Rights depend on design; equal participation is not automatic."
      },
      {
        "question": "Which concern appears in the coin-voting critique?",
        "options": [
          "Too many free textbooks",
          "Unchangeable weather",
          "Wealth dominance and vote buying",
          "Every vote is secret"
        ],
        "correctIndex": 2,
        "explanation": "The essay examines incentives and capture risks."
      },
      {
        "question": "What should follow a successful funding vote?",
        "options": [
          "No further records",
          "Assume payment happened",
          "A price prediction",
          "Check authorization, execution, and accountability"
        ],
        "correctIndex": 3,
        "explanation": "Voting is one stage in the decision process."
      }
    ],
    "sources": [
      {
        "label": "Vitalik Buterin: DAOs are not corporations (2022; argument)",
        "url": "https://vitalik.eth.limo/general/2022/09/20/daos.html"
      },
      {
        "label": "Vitalik Buterin: Moving beyond coin voting governance (2021; critique)",
        "url": "https://vitalik.eth.limo/general/2021/08/16/voting3.html"
      }
    ]
  },
  {
    "module": {
      "id": "ai-agents-and-paid-tools",
      "title": "AI Agents: Reasoning, Tools, and Spending Limits",
      "description": "Distinguish an AI workflow from an agent and explore what changes when software can pay for tools.",
      "whyItMatters": "Distinguish an AI workflow from an agent and explore what changes when software can pay for tools.",
      "objectives": [
        "Distinguish a workflow from an agent",
        "Explain a paid request",
        "Design a budget boundary"
      ],
      "estimatedMinutes": 15,
      "difficulty": "intermediate",
      "tags": [
        "ai",
        "agents",
        "agentic-economy",
        "payments",
        "knowledge-library"
      ]
    },
    "intro": "Distinguish an AI workflow from an agent and explore what changes when software can pay for tools. Read the linked sources, then try the fictional exercise before checking your understanding.",
    "concepts": [
      {
        "title": "Distinguish a workflow from an agent",
        "explanation": "Anthropic distinguishes predefined workflow paths from agents that choose their own steps and tools. It recommends simple designs first, measured against task outcomes. More autonomy can add cost and compounding errors. The 2024 essay is a design reference; tooling has changed."
      },
      {
        "title": "Explain a paid request",
        "explanation": "The existing KB’s x402 introduction describes HTTP-based payments for API or content access. A service can request payment before returning a resource. Payment capability does not establish the quality of the purchased answer."
      },
      {
        "title": "Design a budget boundary",
        "explanation": "Original exercise: give a research assistant a fictional ten-credit allowance. Specify allowed vendors, maximum cost per request, a stop condition, and a review before any public action. Decide how you would detect a paid result that supplies no useful evidence."
      }
    ],
    "practicalExample": "Fictional exercise: Compare two assistants: one follows a fixed read-summarize-check sequence; another chooses sources and purchases access. Define success, spending limits, and the evidence needed to accept either result.",
    "quickActions": [
      "Read the workflow/agent distinction",
      "Sketch a paid request and response",
      "Write one test that would catch a confident but unsupported answer"
    ],
    "summary": "Explain the mechanism, identify who still has power, and name one limitation before judging the claim.",
    "quiz": [
      {
        "question": "What distinguishes the agent in this lesson?",
        "options": [
          "A token ticker",
          "Choosing its steps and tools",
          "A larger logo",
          "A subscription price"
        ],
        "correctIndex": 1,
        "explanation": "The distinction concerns control of the process."
      },
      {
        "question": "What does successful payment prove?",
        "options": [
          "The answer is true",
          "The seller is unbiased",
          "Payment was accepted under the service rules",
          "The task is finished"
        ],
        "correctIndex": 2,
        "explanation": "Payment and information quality require separate checks."
      },
      {
        "question": "When should complexity be added?",
        "options": [
          "Whenever possible",
          "When it measurably improves results",
          "Only for marketing",
          "Without tests"
        ],
        "correctIndex": 1,
        "explanation": "Evaluate outcomes before adding autonomy."
      }
    ],
    "sources": [
      {
        "label": "Anthropic: Building effective agents (2024; design patterns)",
        "url": "https://www.anthropic.com/research/building-effective-agents"
      },
      {
        "label": "x402: Introduction (existing KB; living documentation)",
        "url": "https://docs.x402.org/introduction"
      }
    ]
  },
  {
    "module": {
      "id": "nfts-creator-promises",
      "title": "NFTs: Tokens, Creative Work, and Promises",
      "description": "Separate a unique token record from the creative work, access promises, and services around it.",
      "whyItMatters": "Separate a unique token record from the creative work, access promises, and services around it.",
      "objectives": [
        "Explain the token record",
        "Inventory the promises",
        "Plan for an unavailable service"
      ],
      "estimatedMinutes": 10,
      "difficulty": "beginner",
      "tags": [
        "nft",
        "creator",
        "creator-economy",
        "ethereum",
        "knowledge-library"
      ]
    },
    "intro": "Separate a unique token record from the creative work, access promises, and services around it. Read the linked sources, then try the fictional exercise before checking your understanding.",
    "concepts": [
      {
        "title": "Explain the token record",
        "explanation": "Ethereum.org describes NFTs as individually distinguishable tokens managed by smart contracts. Its examples include art, tickets, and course credentials. A token identifier and its recorded holder are a useful starting point for explaining the mechanism."
      },
      {
        "title": "Inventory the promises",
        "explanation": "Original exercise: a fictional artist sells a membership collectible. Make separate boxes for the token, image hosting, written usage permission, event access, and future services. Do not put a promise into the verified box merely because the token exists."
      },
      {
        "title": "Plan for an unavailable service",
        "explanation": "Suppose the artist’s website disappears. Which boxes can a holder still verify, and which need another operator? Write the verification steps without buying anything. Decide what information you would ask the artist to publish before launch."
      }
    ],
    "practicalExample": "Fictional exercise: Design a fictional course-completion collectible. Specify what it certifies, where evidence is kept, and how a reader can distinguish a completed course from merely acquiring the collectible.",
    "quickActions": [
      "Read the NFT mechanism and use cases",
      "List evidence for each promise in your example",
      "Compare the collectible with a signed downloadable certificate"
    ],
    "summary": "Explain the mechanism, identify who still has power, and name one limitation before judging the claim.",
    "quiz": [
      {
        "question": "What distinguishes a non-fungible token?",
        "options": [
          "Every unit has identical identity",
          "A distinguishable token identity",
          "An automatic profit",
          "A guaranteed event"
        ],
        "correctIndex": 1,
        "explanation": "NFTs distinguish particular tokens."
      },
      {
        "question": "Which needs separate verification in the exercise?",
        "options": [
          "The spelling of NFT",
          "The button color",
          "The promise of future event access",
          "The page margin"
        ],
        "correctIndex": 2,
        "explanation": "A future service requires evidence beyond the token record."
      },
      {
        "question": "What should a course credential clarify?",
        "options": [
          "Only its resale price",
          "Its rarity slogan",
          "Its celebrity owner",
          "What achievement it certifies"
        ],
        "correctIndex": 3,
        "explanation": "A credential is useful when its meaning can be checked."
      }
    ],
    "sources": [
      {
        "label": "Ethereum.org: Non-fungible tokens (living documentation)",
        "url": "https://ethereum.org/nft/"
      }
    ]
  },
  {
    "module": {
      "id": "creator-coins-and-incentives",
      "title": "Creator Coins: Supporting Work or Trading Attention?",
      "description": "Compare creator income, token trading, and products people choose to pay for.",
      "whyItMatters": "Compare creator income, token trading, and products people choose to pay for.",
      "objectives": [
        "Describe a concrete design",
        "Read a challenge to token-first design",
        "Measure useful work separately"
      ],
      "estimatedMinutes": 15,
      "difficulty": "advanced",
      "tags": [
        "creator",
        "creator-economy",
        "creator-coins",
        "tokenomics",
        "knowledge-library"
      ]
    },
    "intro": "Compare creator income, token trading, and products people choose to pay for. Read the linked sources, then try the fictional exercise before checking your understanding.",
    "concepts": [
      {
        "title": "Describe a concrete design",
        "explanation": "Zora’s documentation distinguishes profile-level Creator Coins from post-level Content Coins and describes trading pools and fee rewards. This is one platform’s evolving design, checked October 25, 2026, not a universal definition of creator monetization."
      },
      {
        "title": "Read a challenge to token-first design",
        "explanation": "In Bankless’s April 2026 analysis of Whop, David Christopher argues for starting with products creators already sell and placing crypto behind them. His criticism of earlier creator-token approaches is an interpretation to examine, not a controlled comparison."
      },
      {
        "title": "Measure useful work separately",
        "explanation": "Original exercise: compare a paid tutorial, a recurring membership, and a tradeable creator token. Track completion, customer satisfaction, revenue, and trading volume separately. Ask whether a price rise improved the tutorial or only changed what later buyers paid."
      }
    ],
    "practicalExample": "Fictional exercise: A fictional music teacher wants stable income. Compare selling lessons with launching a coin. Model zero trading activity and a sudden loss of buyer interest before choosing a funding mechanism.",
    "quickActions": [
      "Read the Zora coin-type descriptions",
      "Read Bankless’s final critique of token-first monetization",
      "List who pays, who receives fees, and what customers receive"
    ],
    "summary": "Explain the mechanism, identify who still has power, and name one limitation before judging the claim.",
    "quiz": [
      {
        "question": "Is one platform’s coin design universal?",
        "options": [
          "Yes",
          "Only on weekends",
          "No",
          "Only for famous creators"
        ],
        "correctIndex": 2,
        "explanation": "Implementations and terms differ."
      },
      {
        "question": "Which measures learning rather than trading?",
        "options": [
          "Tutorial completion and comprehension",
          "Token turnover",
          "Ticker mentions",
          "Launch-day price"
        ],
        "correctIndex": 0,
        "explanation": "A learning outcome measures the service itself."
      },
      {
        "question": "What does fee income alone establish?",
        "options": [
          "Every buyer profited",
          "Some activity generated fees",
          "All fans own the business",
          "Demand will last forever"
        ],
        "correctIndex": 1,
        "explanation": "Fees do not establish every participant’s outcome or a durable business."
      }
    ],
    "sources": [
      {
        "label": "Zora: Coins Protocol (living documentation; checked October 25, 2026)",
        "url": "https://docs.zora.co/coins"
      },
      {
        "label": "David Christopher / Bankless: The Side Hustle Economy’s Crypto Moment (2026; analysis)",
        "url": "https://www.bankless.com/read/the-side-hustle-economys-crypto-moment"
      }
    ]
  },
  {
    "module": {
      "id": "bankless-reading-critically",
      "title": "Reading Bankless: Thesis, Evidence, and Incentives",
      "description": "Understand the bankless perspective while checking claims, sponsorships, and alternative explanations.",
      "whyItMatters": "Understand the bankless perspective while checking claims, sponsorships, and alternative explanations.",
      "objectives": [
        "Identify the thesis",
        "Inspect incentives",
        "Build a claim ledger"
      ],
      "estimatedMinutes": 10,
      "difficulty": "beginner",
      "tags": [
        "bankless",
        "finance",
        "media-literacy",
        "knowledge-library"
      ]
    },
    "intro": "Understand the bankless perspective while checking claims, sponsorships, and alternative explanations. Read the linked sources, then try the fictional exercise before checking your understanding.",
    "concepts": [
      {
        "title": "Identify the thesis",
        "explanation": "Bankless’s About page presents crypto as a coordination technology and a route toward greater self-sovereignty. Read that as the publisher’s guiding perspective, not a conclusion the learner must adopt."
      },
      {
        "title": "Inspect incentives",
        "explanation": "Its Disclosures page describes crypto holdings, contributor interests, and venture investments. Disclosed interests help frame a source; they neither automatically refute its argument nor substitute for checking evidence."
      },
      {
        "title": "Build a claim ledger",
        "explanation": "Original exercise: choose an accessible essay. Make four columns: factual claim, linked evidence, interpretation, and uncertainty. Write the strongest alternative explanation for one claim. If the evidence is missing, leave the box empty rather than guessing."
      }
    ],
    "practicalExample": "Fictional exercise: A fictional article predicts that creators will earn more after adopting tokens. Separate the prediction from observed earnings, identify whose earnings were measured, and propose a comparison that could challenge the thesis.",
    "quickActions": [
      "Read About and Disclosures together",
      "Check one claim against its original evidence",
      "Write what would change your mind"
    ],
    "summary": "Explain the mechanism, identify who still has power, and name one limitation before judging the claim.",
    "quiz": [
      {
        "question": "How should a publisher thesis be treated?",
        "options": [
          "As a perspective to evaluate",
          "As a law of nature",
          "As a price guarantee",
          "As every reader’s belief"
        ],
        "correctIndex": 0,
        "explanation": "A thesis frames an argument; evidence still matters."
      },
      {
        "question": "Does disclosure prove an article false?",
        "options": [
          "Always",
          "No",
          "Only if it has a chart",
          "Only if it mentions ETH"
        ],
        "correctIndex": 1,
        "explanation": "Conflicts deserve scrutiny but are not a logical disproof."
      },
      {
        "question": "What is the best response to missing evidence?",
        "options": [
          "Invent a plausible number",
          "Use popularity as proof",
          "Mark it unverified and seek the original source",
          "Ignore the gap"
        ],
        "correctIndex": 2,
        "explanation": "Keep uncertainty visible."
      }
    ],
    "sources": [
      {
        "label": "Bankless: About (publisher perspective)",
        "url": "https://www.bankless.com/about"
      },
      {
        "label": "Bankless: Disclosures (conflicts of interest)",
        "url": "https://www.bankless.com/disclosures"
      }
    ]
  },
  {
    "module": {
      "id": "privacy-coins-and-metadata",
      "title": "Privacy Crypto: What Is Hidden, and From Whom?",
      "description": "Compare Monero and shielded Zcash while separating transaction privacy from device and network exposure.",
      "whyItMatters": "Compare Monero and shielded Zcash while separating transaction privacy from device and network exposure.",
      "objectives": [
        "Read the privacy boundary",
        "Separate transparent and shielded activity",
        "Use historical research carefully"
      ],
      "estimatedMinutes": 15,
      "difficulty": "advanced",
      "tags": [
        "privacy",
        "encryption",
        "monero",
        "zcash",
        "crypto",
        "knowledge-library"
      ]
    },
    "intro": "Compare Monero and shielded Zcash while separating transaction privacy from device and network exposure. Read the linked sources, then try the fictional exercise before checking your understanding.",
    "concepts": [
      {
        "title": "Read the privacy boundary",
        "explanation": "Monero’s FAQ describes transaction privacy protections and explicitly rejects a guarantee of complete anonymity. Compromised devices or voluntarily disclosed identity can still expose a user. Treat project descriptions as claims about mechanisms and boundaries, not magic."
      },
      {
        "title": "Separate transparent and shielded activity",
        "explanation": "Z.cash distinguishes public transparent activity from shielded activity. Its short explainer makes the choice important; do not assume every transaction using the asset has the same privacy properties."
      },
      {
        "title": "Use historical research carefully",
        "explanation": "The reviewed abstract of Kappos and colleagues’ 2018 empirical study says identifiable usage patterns can shrink anonymity sets in the then-deployed Zcash system. This is historical evidence, not a current exploit claim or a benchmark of today’s pools. Original exercise: list the observers of a fictional payment—recipient, device operator, node, and public ledger—and what each might learn."
      }
    ],
    "practicalExample": "Fictional exercise: A fictional learner wants to keep a donation private. Write what privacy means against each observer and which assumptions require verification. No transfer, purchase, or installation is needed.",
    "quickActions": [
      "Read the Monero FAQ limitations",
      "Compare shielded and transparent activity",
      "Date the study and separate historical findings from current questions"
    ],
    "summary": "Explain the mechanism, identify who still has power, and name one limitation before judging the claim.",
    "quiz": [
      {
        "question": "Does transaction privacy guarantee a safe device?",
        "options": [
          "No",
          "Always",
          "Only for large transfers",
          "Only at night"
        ],
        "correctIndex": 0,
        "explanation": "Device security is a separate boundary."
      },
      {
        "question": "What does the Zcash explainer distinguish?",
        "options": [
          "Only two logos",
          "Transparent and shielded activity",
          "Two guaranteed returns",
          "Two membership tiers"
        ],
        "correctIndex": 1,
        "explanation": "Privacy depends on the activity and supported path."
      },
      {
        "question": "How should the 2018 abstract be used?",
        "options": [
          "As proof of a current exploit",
          "As a full review of modern pools",
          "As historical evidence with limited scope",
          "As proof that privacy is impossible"
        ],
        "correctIndex": 2,
        "explanation": "Do not generalize an old study beyond its time and reviewed scope."
      }
    ],
    "sources": [
      {
        "label": "Monero project: FAQ (privacy and limitations)",
        "url": "https://www.getmonero.org/get-started/faq/"
      },
      {
        "label": "Z.cash: Shielded and transparent Zcash (documentation)",
        "url": "https://z.cash/learn/what-is-the-difference-between-shielded-and-transparent-zcash/"
      },
      {
        "label": "Kappos et al.: An Empirical Analysis of Anonymity in Zcash (2018; abstract only)",
        "url": "https://arxiv.org/abs/1805.03180"
      }
    ]
  }
];

export const KNOWLEDGE_LIBRARY_PLAN = {
  track: 'decentralization' as const,
  level: 'beginner' as const,
  summary: 'Explore Bitcoin, Ethereum, decentralization, DAOs, AI agents, creator economies, and privacy. Choose a course and examine its sources and tradeoffs.',
  modules: KNOWLEDGE_LIBRARY_CURRICULUM.map(({ module }) => module),
};
