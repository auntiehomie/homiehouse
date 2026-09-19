export interface CuratedLearningModule {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  objectives: string[];
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

export interface CuratedLesson {
  module: CuratedLearningModule;
  intro: string;
  concepts: Array<{ title: string; explanation: string; analogy?: string }>;
  practicalExample: string;
  quickActions: string[];
  summary: string;
  quiz: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
  sources: Array<{ label: string; url: string }>;
}

const ETHEREUM_SECURITY = {
  label: 'Ethereum.org security and scam prevention',
  url: 'https://ethereum.org/security/',
};

const INVESTOR_RED_FLAGS = {
  label: 'Investor.gov fraud red flags',
  url: 'https://www.investor.gov/',
};

export const SAFETY_CURRICULUM: CuratedLesson[] = [
  {
    module: {
      id: 'wallet-basics',
      title: 'Wallet Safety Before Your First Dollar',
      description: 'Learn what a wallet controls, how recovery phrases work, and how to separate everyday activity from long-term storage.',
      whyItMatters: 'Self-custody gives you control, but a leaked recovery phrase or careless signature can make a loss permanent.',
      objectives: ['Explain what a wallet actually stores', 'Protect a recovery phrase offline', 'Separate a daily wallet from savings', 'Verify addresses before sending'],
      estimatedMinutes: 12,
      difficulty: 'beginner',
      tags: ['wallet', 'security', 'self-custody'],
    },
    intro: 'A wallet does not hold coins like a leather wallet holds cash. It controls the keys that authorize transactions, so your first job is protecting those keys and limiting what any one wallet can lose.',
    concepts: [
      { title: 'Keys, not coins', explanation: 'Your assets are recorded on a blockchain. Your wallet protects the private keys that prove you can move them. A recovery phrase can recreate those keys, so anyone who sees it can take control. Legitimate support staff will never need it.', analogy: 'Your public address is like an account number; your private key is the signature that can empty the account.' },
      { title: 'Split the blast radius', explanation: 'Use one low-balance wallet for trying apps and a separate wallet for assets you intend to keep. Consider a hardware wallet for meaningful savings because its keys remain offline. Separation cannot prevent every mistake, but it limits how much one bad approval can reach.', analogy: 'You do not carry your entire savings account in your pocket just because you need lunch money.' },
      { title: 'Verify before sending', explanation: 'Blockchain transfers are generally irreversible. Check the network, token, full destination address, and transaction details before signing. For a new destination, a small test transfer can catch an address or network mistake before the larger transfer.', analogy: 'A test transfer is the crypto version of measuring twice and cutting once.' },
    ],
    practicalExample: 'Maya keeps a small amount in a phone wallet for Mini Apps and stores long-term assets behind a hardware wallet. When she tries a new app, the app never gets access to the wallet containing her savings.',
    quickActions: ['Write down which wallet is for daily use and which is for savings', 'Confirm your recovery phrase is offline and never stored as a screenshot', 'Practice checking the network and the first and last six characters of an address'],
    summary: 'Treat wallet design as risk design. Separate funds, keep recovery secrets offline, and verify every irreversible action.',
    quiz: [
      { question: 'What does a crypto wallet primarily protect?', options: ['Coins stored inside the app', 'Private keys that authorize transactions', 'A copy of the entire internet', 'Exchange customer support access'], correctIndex: 1, explanation: 'Assets remain on-chain; the wallet protects the keys used to control them.' },
      { question: 'Why use a separate everyday wallet?', options: ['To increase token prices', 'To avoid paying all network fees', 'To limit the funds exposed to an unsafe app or approval', 'To make transactions reversible'], correctIndex: 2, explanation: 'Wallet separation limits the blast radius. It does not change prices, fees, or transaction finality.' },
      { question: 'What is safest when sending to a new address?', options: ['Send everything at once', 'Trust the shortened address alone', 'Share your recovery phrase for confirmation', 'Verify details and consider a small test transfer'], correctIndex: 3, explanation: 'A verified test transfer can reveal an address or network mistake before more funds are at risk.' },
    ],
    sources: [ETHEREUM_SECURITY],
  },
  {
    module: {
      id: 'scam-defense',
      title: 'Scam Defense: Slow Down the Ask',
      description: 'Recognize urgency, impersonation, fake support, giveaways, and recovery-phrase requests before they become losses.',
      whyItMatters: 'Most scam protection starts before a transaction: pause, verify through a separate channel, and refuse secret requests.',
      objectives: ['Spot urgency and guaranteed-return red flags', 'Verify support through official channels', 'Check domains independently', 'Use a repeatable pause-and-verify routine'],
      estimatedMinutes: 12,
      difficulty: 'beginner',
      tags: ['scams', 'phishing', 'social-engineering'],
    },
    intro: 'Scammers try to make careful people act quickly. The safest habit is simple: slow the interaction down, leave the message, and verify the claim using a channel you found independently.',
    concepts: [
      { title: 'Urgency is a tool', explanation: 'Pressure to act now, fear of missing out, guaranteed returns, and promises of free money are classic fraud signals. A deadline can be real, but it never removes your need to verify. If a deal fails because you took time to understand it, it was not appropriate for you.', analogy: 'Urgency is the magician waving one hand so you do not watch the other.' },
      { title: 'Support does not DM first', explanation: 'Impersonators monitor public chats and offer private help. Do not move to an unofficial channel, install remote-access software, or reveal passwords, private keys, or recovery phrases. Navigate to the project site yourself and use its published support path.', analogy: 'A stranger wearing a bank badge is still a stranger until the bank confirms them.' },
      { title: 'Verify out of band', explanation: 'Do not use the phone number, domain, or link supplied by a suspicious message to verify that same message. Open a saved bookmark or type the known domain yourself. Compare the request with official announcements and ask the community in public without sharing private information.', analogy: 'Do not ask the person at the door to print their own ID card.' },
    ],
    practicalExample: 'A message says your wallet will be frozen unless you connect within ten minutes. You close it, open the wallet provider from a saved bookmark, and find no alert. The artificial deadline was the scam.',
    quickActions: ['Bookmark the official sites for the wallet and apps you use', 'Write a personal rule: nobody gets my recovery phrase or remote access', 'Find the official public support channel for one service you use'],
    summary: 'Pause, leave the message, and verify independently. Urgency is never permission to surrender your security routine.',
    quiz: [
      { question: 'Which combination is a strong fraud warning?', options: ['Clear fees and time to research', 'Guaranteed returns plus pressure to act now', 'Open-source code and public documentation', 'A small test transaction'], correctIndex: 1, explanation: 'Investor.gov highlights high-return promises, pressure, and FOMO as common fraud red flags.' },
      { question: 'How should you verify a suspicious support message?', options: ['Use the link in the message', 'Send a recovery phrase as proof', 'Find the official channel independently', 'Allow remote access to your device'], correctIndex: 2, explanation: 'Independent verification avoids relying on contact details controlled by the possible scammer.' },
      { question: 'What should legitimate support need from you?', options: ['Your seed phrase', 'Your private key', 'A transfer to unlock support', 'None of those secrets or payments'], correctIndex: 3, explanation: 'Legitimate support does not need recovery secrets, private keys, or a payment to diagnose an account.' },
    ],
    sources: [ETHEREUM_SECURITY, INVESTOR_RED_FLAGS],
  },
  {
    module: {
      id: 'transaction-safety',
      title: 'Read Before You Sign',
      description: 'Understand token approvals, transaction simulations, spending limits, and why connecting a wallet is not the same as signing.',
      whyItMatters: 'A malicious signature can be more dangerous than visiting a malicious page because it can authorize an on-chain action.',
      objectives: ['Distinguish connection from signing', 'Recognize token approvals', 'Avoid unlimited spending limits', 'Review and revoke stale permissions'],
      estimatedMinutes: 15,
      difficulty: 'beginner',
      tags: ['transactions', 'approvals', 'wallet-drainers'],
    },
    intro: 'Wallet prompts are not routine pop-ups. Each signature is a request for authority, and your safest default is to understand the action before granting it.',
    concepts: [
      { title: 'Connection versus authority', explanation: 'Connecting commonly reveals your public address. Signing a message proves control of an address, while signing a transaction can change on-chain state. Read the wallet prompt because similar-looking buttons can request very different powers.', analogy: 'Showing an ID, signing a receipt, and signing power of attorney are not the same act.' },
      { title: 'Approvals persist', explanation: 'A token approval lets a smart contract spend up to an allowed amount. Some apps request unlimited allowances for convenience, but that increases the damage if the contract or interface is compromised. Prefer the amount needed for the transaction when your wallet supports it.', analogy: 'A one-time purchase should not require handing the store a permanent blank check.' },
      { title: 'Review and revoke', explanation: 'Old approvals can outlive the app session that created them. Periodically review permissions using a trusted block explorer or approval checker reached from an official source. Revoking a permission is an on-chain transaction and normally requires network fees.', analogy: 'Revoke old approvals like collecting spare keys from former contractors.' },
    ],
    practicalExample: 'A swap asks for unlimited access to USDC even though Devon only wants to swap $25. Devon changes the allowance to the required amount and confirms the recipient and network before signing.',
    quickActions: ['Open your wallet settings and find its transaction simulation or warning features', 'Review one existing token allowance from a trusted explorer', 'Practice explaining the difference between connect, sign message, and sign transaction'],
    summary: 'Every signature grants something. Read the action, narrow the permission, and remove authority you no longer need.',
    quiz: [
      { question: 'What can a token approval do?', options: ['Authorize a contract to spend tokens up to a limit', 'Reverse any blockchain transaction', 'Hide your public address', 'Recover a lost seed phrase'], correctIndex: 0, explanation: 'An approval grants a specific spender authority over a token amount; it does not reverse transfers or recover secrets.' },
      { question: 'Why avoid an unlimited allowance when it is unnecessary?', options: ['It always costs more gas', 'It exposes more funds if the spender is compromised', 'It changes the token price', 'It reveals your recovery phrase'], correctIndex: 1, explanation: 'A larger persistent allowance creates a larger potential loss if that authority is abused.' },
      { question: 'Which action usually changes on-chain state?', options: ['Viewing a public address', 'Reading a help article', 'Signing and submitting a transaction', 'Closing a browser tab'], correctIndex: 2, explanation: 'A submitted transaction can alter balances or permissions on-chain.' },
    ],
    sources: [ETHEREUM_SECURITY],
  },
  {
    module: {
      id: 'risk-budget',
      title: 'Build a Risk Budget, Not a Price Target',
      description: 'Decide what you can afford to lose, cap concentration, and keep essential money outside speculative positions.',
      whyItMatters: 'You cannot control market prices, but you can control position size and whether one mistake threatens your life outside crypto.',
      objectives: ['Define money that must not be risked', 'Size positions before buying', 'Recognize concentration risk', 'Write exit and review rules'],
      estimatedMinutes: 15,
      difficulty: 'beginner',
      tags: ['risk', 'position-sizing', 'financial-literacy'],
    },
    intro: 'Survival in crypto is less about predicting the next winner and more about making sure one wrong decision cannot remove you from the game.',
    concepts: [
      { title: 'Protect real life first', explanation: 'Rent, bills, emergency savings, taxes, and near-term goals are not speculative capital. Crypto prices and protocols can fail quickly, and access can be disrupted at the worst time. Decide the maximum total loss your life can absorb before deciding what to buy.', analogy: 'A storm fund should not depend on tomorrow having sunny weather.' },
      { title: 'Size before the story', explanation: 'Choose a position limit before excitement or fear changes your judgment. Smaller positions make it easier to investigate, wait, and admit a mistake. A risk budget can be expressed as a small percentage or a fixed dollar amount, but it must fit your actual finances.', analogy: 'Set the speed limit before you reach the sharp turn.' },
      { title: 'Concentration hides', explanation: 'Five tokens can still be one bet if they depend on the same chain, stablecoin, bridge, team, or market narrative. Map shared dependencies and count illiquid rewards or locked tokens conservatively. Diversification reduces some risks; it does not make speculative assets safe.', analogy: 'Owning five cabins in the same floodplain is not geographic diversification.' },
    ],
    practicalExample: 'Jordan has $500 that can be lost without touching bills or emergency savings. Instead of placing all of it in one new protocol, Jordan sets smaller experiment limits and keeps a written record of the remaining risk budget.',
    quickActions: ['Write the categories of money that are never available for crypto', 'Choose a maximum experiment size before researching a token', 'List the shared chain, bridge, and stablecoin dependencies in your current positions'],
    summary: 'Position size is a safety feature. Protect essential money and assume correlated bets can fail together.',
    quiz: [
      { question: 'Which money belongs in a speculative risk budget?', options: ['Next month’s rent', 'Emergency savings', 'Money whose total loss would not disrupt essential needs', 'Tax money already owed'], correctIndex: 2, explanation: 'Essential and committed funds should not depend on speculative market outcomes.' },
      { question: 'Why set position size before buying?', options: ['To guarantee a profit', 'To reduce emotion-driven exposure', 'To eliminate smart-contract risk', 'To avoid all taxes'], correctIndex: 1, explanation: 'Precommitting a limit helps keep excitement and fear from expanding the amount at risk.' },
      { question: 'When can several tokens still be one concentrated bet?', options: ['When they share critical dependencies', 'When their logos differ', 'When they are held in separate tabs', 'When prices update at different times'], correctIndex: 0, explanation: 'Shared chains, bridges, stablecoins, teams, or narratives can cause positions to fail together.' },
    ],
    sources: [INVESTOR_RED_FLAGS],
  },
  {
    module: {
      id: 'protocol-due-diligence',
      title: 'Protocol Due Diligence Without the Hype',
      description: 'Use a repeatable checklist for control, code, liquidity, incentives, and failure scenarios before depositing.',
      whyItMatters: 'A high displayed yield is not a complete explanation of where returns come from or who bears the risk.',
      objectives: ['Trace the source of yield', 'Identify admin and upgrade control', 'Evaluate liquidity and exit paths', 'Write a pre-mortem before depositing'],
      estimatedMinutes: 18,
      difficulty: 'intermediate',
      tags: ['defi', 'due-diligence', 'protocol-risk'],
    },
    intro: 'Due diligence is not finding enough reasons to say yes. It is understanding how a system works, how you get out, and what must remain true for your funds to be safe.',
    concepts: [
      { title: 'Follow the return', explanation: 'Ask whether yield comes from borrower interest, trading fees, token emissions, leverage, or a subsidy. Emissions can advertise a high rate while diluting the reward token. If the source cannot be explained plainly, do not treat the displayed percentage as evidence.', analogy: 'Before admiring the water pressure, find out whether the tank is being refilled.' },
      { title: 'Map control and code', explanation: 'Audits reduce uncertainty but do not guarantee safety. Check how long contracts have operated, whether they can be upgraded, who controls admin keys, and whether a pause or withdrawal limit exists. Governance and multisig design determine who can change the rules.', analogy: 'An inspection matters, but you still need to know who holds the building keys.' },
      { title: 'Plan the exit', explanation: 'TVL is not the same as immediately available exit liquidity. Consider slippage, withdrawal queues, bridge dependence, collateral quality, and what happens during a rush for the door. Write a pre-mortem: if the position loses most of its value, what likely broke first?', analogy: 'A crowded venue is only safe when the exits work under pressure.' },
    ],
    practicalExample: 'Before depositing into a vault, Lee traces the yield to token emissions, finds an upgradeable contract controlled by a small multisig, and tests a small withdrawal. The headline rate now has a visible risk story.',
    quickActions: ['For one protocol, write one sentence explaining where yield comes from', 'Find its admin or upgrade documentation and recent audit links', 'Describe the fastest plausible failure and how you would exit'],
    summary: 'A yield is a payment for some risk. Trace the payment, map control, and test the exit before increasing exposure.',
    quiz: [
      { question: 'What is the first question behind a displayed yield?', options: ['Is the logo attractive?', 'Where does the return come from?', 'How many followers does it have?', 'Will the price rise tomorrow?'], correctIndex: 1, explanation: 'The yield source reveals whether returns come from real activity, incentives, leverage, or another risk transfer.' },
      { question: 'What does an audit prove?', options: ['The protocol can never fail', 'All admin keys are decentralized', 'Reviewers examined a stated scope at a point in time', 'Liquidity will always be available'], correctIndex: 2, explanation: 'An audit is useful evidence within its scope, not a guarantee against every bug, control risk, or future change.' },
      { question: 'Why test an exit with a small amount?', options: ['To guarantee future liquidity', 'To make losses tax-free', 'To remove bridge risk', 'To learn the actual withdrawal path before more capital depends on it'], correctIndex: 3, explanation: 'A small test verifies mechanics and surfaces friction, though it cannot guarantee the exit will work during stress.' },
    ],
    sources: [ETHEREUM_SECURITY, INVESTOR_RED_FLAGS],
  },
];

export const SAFETY_MODULES = SAFETY_CURRICULUM.map(({ module }) => module);

export function getSafetyLesson(id: string): CuratedLesson | undefined {
  return SAFETY_CURRICULUM.find(({ module }) => module.id === id);
}

