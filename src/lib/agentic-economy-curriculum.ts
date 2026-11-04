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
];
