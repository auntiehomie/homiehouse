import type { CuratedLesson } from './safety-curriculum';

const nistGenAiProfile = {
  label: 'NIST: Generative AI Profile (AI RMF)',
  url: 'https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence',
};
const owaspAgentSecurity = {
  label: 'OWASP: AI Agent Security Cheat Sheet',
  url: 'https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html',
};

/** Practical AI lessons on agent capabilities, permissions, and human oversight. */
export const AGENTIC_ECONOMY_CURRICULUM: CuratedLesson[] = [
  {
    module: {
      id: 'agent-permissions-and-oversight',
      title: 'Let an AI Agent Work Safely: Scope, Permissions, and Oversight',
      description: 'Learn how to delegate useful work to an AI agent while limiting its tools, data access, and authority over important actions.',
      whyItMatters: 'An agent can do more than produce text: it may read information or take actions through connected tools. Clear boundaries make delegation useful while keeping people accountable for consequential decisions.',
      objectives: [
        'Distinguish an AI assistant from an agent that can use tools',
        'Match permissions to the smallest set of actions a task needs',
        'Choose when an agent may act, prepare a draft, or ask for approval',
        'Describe a practical way to review and improve an agent task',
      ],
      estimatedMinutes: 16,
      difficulty: 'intermediate',
      tags: ['ai', 'agents', 'agentic-economy', 'permissions', 'oversight', 'security'],
    },
    relatedLessons: ['transaction-safety', 'scam-defense'],
    intro: 'AI agents can search, organize, and prepare work. Some can also send messages, change files, or move money. Delegating well means deciding what an agent may see and do before it starts, then checking the result.',
    concepts: [
      {
        title: 'An agent can use tools',
        explanation: 'A chat assistant mainly responds with information. An agent can also call connected tools to retrieve data or request actions, such as searching a site, drafting a post, or updating a record. The model’s suggestion and the tool’s permission are separate: a convincing answer does not automatically authorize an action.',
        analogy: 'A travel adviser can suggest an itinerary; a travel agent with your card details can also book it. The second role needs clearer limits.',
      },
      {
        title: 'Give it only what the task needs',
        explanation: 'Start with a narrow task and the smallest useful set of tools and data. If an agent only needs public posts to prepare a summary, it should not also receive access to private messages, account settings, or a wallet. Narrow access reduces the damage a mistake or malicious instruction can cause.',
        analogy: 'Give a temporary helper a key to the meeting room, not a master key to the whole building.',
      },
      {
        title: 'Scale permission to impact',
        explanation: 'Reading public information is usually easier to undo than sending a message, changing an account, or transferring funds. Let low-impact steps happen automatically when appropriate; keep consequential or hard-to-reverse actions behind a clear human approval. Approval should show the exact action and its important details.',
      },
      {
        title: 'Review the work and keep a record',
        explanation: 'Check whether the task was completed, which sources or tools were used, and where you had to correct the result. Keep a short record of the request, the output, and approvals. This makes it easier to spot repeated errors and decide whether the agent has earned a broader role. NIST recommends risk-appropriate oversight, review, tracking, and documentation for generative AI use.',
      },
    ],
    practicalExample: 'A Homiehouse community manager asks an agent to prepare a weekly plain-English summary from public casts. The agent may search public posts and save a private draft. It cannot publish, reply, read private messages, change settings, or sign a wallet transaction. A person checks sources, edits the draft, and chooses whether to post it.',
    quickActions: [
      'Exercise: Choose one task and list the information the agent needs, the tools it may use, and one action it must not take.',
      'Mark each allowed action as read, draft, or execute. Add a human approval step for anything public, financial, or hard to reverse.',
      'Next step: Try a low-stakes task in read-only or draft-only mode for one week. Keep a simple note of useful results, errors, and how often you needed to intervene.',
    ],
    summary: 'Delegate a specific task, limit access to what it needs, and require human approval for actions with meaningful consequences. Review the results before expanding what the agent can do.',
    quiz: [
      {
        question: 'A summary agent only needs public posts. What is the best starting permission?',
        options: ['Access to all account messages', 'Read public posts and prepare a private draft', 'Permission to publish and change account settings', 'Wallet signing access'],
        correctIndex: 1,
        explanation: 'The least-permission setup gives it the data and tools needed for the summary without unrelated access.',
      },
      {
        question: 'Which action most clearly needs a human approval step?',
        options: ['Searching public posts', 'Sorting a private draft by date', 'Publishing a post to the public account', 'Counting words in a summary'],
        correctIndex: 2,
        explanation: 'Publishing is public and can be difficult to fully undo, so a person should review the exact post first.',
      },
      {
        question: 'What is a useful reason to keep a short record of agent work?',
        options: ['To guarantee the agent is always correct', 'To see which tools it used and where corrections were needed', 'To give the agent permanent access', 'To remove the need for review'],
        correctIndex: 1,
        explanation: 'A record helps people evaluate outcomes, spot recurring errors, and adjust permissions responsibly.',
      },
    ],
    sources: [nistGenAiProfile, owaspAgentSecurity],
  },

  {
    module: {
      id: 'agent-payments-with-x402',
      title: 'How AI Agents Pay for Digital Services',
      description: 'Learn how the x402 standard lets software pay for an API request, what happens in the payment flow, and what spending limits an agent still needs.',
      whyItMatters: 'Agents can only complete some jobs if they can buy information or computing when needed. Per-request payments can make that possible, but automated spending still needs clear limits and review.',
      objectives: [
        'Explain what an HTTP 402 payment response tells a client',
        'Describe the basic x402 request, payment, verification, and delivery flow',
        'Distinguish a payment protocol from permission to spend',
        'Design simple limits for a hypothetical agent purchase',
      ],
      estimatedMinutes: 14,
      difficulty: 'beginner',
      tags: ['ai', 'agents', 'agentic-economy', 'x402', 'payments', 'web3'],
    },
    relatedLessons: ['agent-permissions-and-oversight', 'transaction-safety'],
    intro: 'An AI agent may need a paid data service to finish a task. The x402 standard uses the web’s HTTP request-and-response system to let a service ask for payment and let a software client respond programmatically. It can reduce checkout friction, but it does not decide whether the purchase is wise or authorized.',
    concepts: [
      {
        title: 'A service can ask for payment in its response',
        explanation: 'A client requests a resource, such as one data lookup. If payment is required, the service responds with HTTP 402 Payment Required and provides payment requirements. The client can then decide whether it is able and allowed to pay. The 402 response is an offer and instruction, not an instruction that the agent must accept.',
        analogy: 'A parking meter can show the price before you park. Seeing the price does not mean your card should automatically be charged.',
      },
      {
        title: 'Payment and delivery have several steps',
        explanation: 'In the common x402 flow, the client requests a resource; the server returns payment requirements; the client prepares a payment payload; and the server or a facilitator verifies it and settles the payment. After successful verification, the server delivers the resource. A facilitator can help with verification and settlement, but it does not choose whether the agent should buy the resource.',
      },
      {
        title: 'The protocol does not set your budget',
        explanation: 'The x402 standard describes how payment information moves between a client and a service. The app or its operator still needs to decide which services an agent may use, which networks and assets are acceptable, how much a single request can cost, and when a person must approve. A low price per request can still add up when repeated many times.',
      },
      {
        title: 'Connect payment to a useful result',
        explanation: 'A paid request should have a clear purpose and a measurable result. Before an agent pays, it can check that the service matches the task, the requested price is within policy, and the response is useful enough to continue. Keep a record of the request, amount, service, and result so someone can review the spending.',
      },
    ],
    practicalExample: 'Fictional example: a research agent needs one weather-data lookup for a travel answer. The API replies with a 402 and payment details. The app checks that the service is approved, the quoted cost is below its per-request limit, and the total daily budget is not used up. If those checks pass, it can pay and retry the request; otherwise it asks its owner or uses a free source. The data is delivered only after the service verifies payment.',
    quickActions: [
      'Exercise: For the fictional weather lookup, write a purchase rule with an approved service, a per-request cap, a daily cap, an allowed network, and one reason to ask a person before paying.',
      'Name one thing the protocol handles (payment instructions or payment verification) and one thing your policy must handle (whether this agent is allowed to spend).',
      'Next step: Before connecting any agent to a paid service, simulate five sample requests on paper and total the possible cost. Set limits before trying a live integration.',
    ],
    summary: 'x402 can make online services payable through a software-friendly HTTP flow. It does not provide a spending policy: the agent still needs an approved purpose, price limits, service checks, and a record of what it bought.',
    quiz: [
      {
        question: 'What does HTTP 402 mean in the basic x402 flow?',
        options: ['The client is automatically approved to spend any amount', 'The service is asking for payment and providing payment requirements', 'The requested resource has been delivered', 'The agent has signed a permanent subscription'],
        correctIndex: 1,
        explanation: 'The 402 response communicates that payment is required and gives the client details for a possible payment.',
      },
      {
        question: 'Who decides whether an agent is allowed to spend up to a set amount?',
        options: ['The 402 status code by itself', 'The service’s payment response', 'The application or operator policy', 'The HTTP protocol generally'],
        correctIndex: 2,
        explanation: 'The payment flow carries requirements, while the app or its operator must define authorization and spending limits.',
      },
      {
        question: 'When does the service normally deliver the paid resource?',
        options: ['After it verifies the payment', 'Before the client makes any request', 'As soon as the agent sees the price', 'Only after a human creates an account'],
        correctIndex: 0,
        explanation: 'The server delivers the resource after successful payment verification in the common flow.',
      },
    ],
    sources: [
      { label: 'x402 documentation: Welcome to x402', url: 'https://docs.x402.org/introduction' },
      { label: 'x402 Foundation protocol repository and flow', url: 'https://github.com/x402-foundation/x402' },
      { label: 'OWASP AI Agent Security Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html' },
    ],
  },
];
