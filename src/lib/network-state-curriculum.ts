import type { CuratedLesson } from './safety-curriculum';

const proposal = { label: 'Balaji: The Network State in One Thousand Words', url: 'https://thenetworkstate.com/the-network-state-in-one-thousand-words' };
const essay = { label: 'Balaji: The Network State in One Essay', url: 'https://thenetworkstate.com/the-network-state-in-one-essay' };
const book = { label: 'Balaji: The Network State (book)', url: 'https://thenetworkstate.com/book/tns.pdf' };
const review = { label: 'Vitalik Buterin: What do I think about network states? (2022)', url: 'https://vitalik.eth.limo/general/2022/07/13/networkstates.html' };
const commons = { label: 'De Filippi / The Blockchain Socialist: written episode introduction (audio not reviewed)', url: 'https://theblockchainsocialist.com/overthrowing-the-network-state-an-initial-critique-and-alternatives/' };
const modular = { label: 'Schneider et al.: Modular Politics (abstract; predates the book)', url: 'https://arxiv.org/abs/2005.13701' };

/** Authored lessons: proposals and objections stay together, including without an LLM. */
export const NETWORK_STATE_CURRICULUM: CuratedLesson[] = [
  {
    module: {
      id: 'network-states-foundations',
      title: 'Can an Online Community Become a Country?',
      description: 'Understand Balaji’s proposal, distinguish its stages, and examine the gap between a successful community and political recognition.',
      whyItMatters: 'Understanding a proposal does not require endorsing it. Clear definitions make disagreements easier to evaluate.',
      objectives: ['Explain the online-to-offline proposal', 'Distinguish organization, ownership, and recognition', 'Separate a forecast from demonstrated evidence'],
      estimatedMinutes: 12, difficulty: 'beginner', tags: ['network-states', 'governance', 'decentralization', 'decentralized-social'],
    },
    intro: 'Could people meet online, build a community in the physical world, and eventually seek recognition as a country? This course explains the proposal and the questions it leaves open.',
    concepts: [
      { title: 'The proposed progression', explanation: 'Balaji begins with a startup society: an online group with shared purpose. It develops collective action, offline trust, an internal economy, funded physical locations, connections between them, and an auditable census. Seeking diplomatic recognition is the proposed final stage. This is a roadmap he advocates, not a demonstrated guarantee of success. [Reading: Balaji’s shorter roadmap.]' },
      { title: 'What would count as evidence?', explanation: 'Separate three questions: Can people coordinate? Can they sustain useful shared services? Can their organization obtain the political status it seeks? Membership counts may help answer the first question, while budgets and service outcomes address the second. Neither measurement alone answers the third. In an original classroom exercise, a million newsletter subscribers prove reach, not consent to a government.' },
      { title: 'A constructive counterpoint', explanation: 'Vitalik supports governance experimentation but challenges lasting founder control, unequal access, exit as a complete political solution, and harms beyond a community’s borders. His review shows how someone can accept parts of a project while rejecting others. Treat this as an argument to assess, not an authoritative verdict. [Reading: Vitalik’s review.]' },
    ],
    practicalExample: 'Fictional scenario: an online repair club pools funds for workshops in three cities. It now has shared assets and useful services. Its members still need to establish who controls budgets, how disputes work, and what political status they are actually seeking.',
    quickActions: ['Read Balaji’s short roadmap and mark each proposed stage', 'Read the objections section of Vitalik’s review', 'Write one benefit your community could deliver without becoming a state'],
    summary: 'Community coordination and statehood are different questions. Evaluate the proposed transition with evidence rather than assuming that growth settles it.',
    quiz: [
      { question: 'In Balaji’s roadmap, what comes first?', options: ['Diplomatic recognition', 'An online startup society', 'A compulsory national currency', 'A standing army'], correctIndex: 1, explanation: 'The roadmap begins with an online startup society and develops physical and political ambitions later.' },
      { question: 'What does a large membership count directly measure?', options: ['Diplomatic recognition', 'Unanimous consent to every rule', 'The number counted under a membership definition', 'The quality of every public service'], correctIndex: 2, explanation: 'A count depends on its membership definition; it does not by itself establish recognition, consent, or service quality.' },
      { question: 'How is Vitalik’s review best described here?', options: ['Support for experimentation with substantial objections', 'Proof that all startup societies fail', 'Agreement with every part of Balaji’s model', 'A treaty recognizing a new state'], correctIndex: 0, explanation: 'The review combines interest in experimentation with objections and proposed changes.' },
    ],
    sources: [proposal, essay, book, review],
  },
  {
    module: {
      id: 'network-states-governance', title: 'Who Makes the Rules?',
      description: 'Compare founder coordination, member voice, appeals, and the practical ability to leave.',
      whyItMatters: 'A community’s values matter less if members cannot question how those values are enforced.',
      objectives: ['Explain the coordination case for founders', 'Distinguish exit from voice', 'Design a reviewable transfer of authority'],
      estimatedMinutes: 15, difficulty: 'intermediate', tags: ['network-states', 'governance', 'decentralization'],
    },
    intro: 'A founder can get people moving in one direction. The next question is what happens when members disagree, the founder leaves, or the rules change.',
    concepts: [
      { title: 'The coordination argument', explanation: 'A clear leader and shared mission can reduce early disagreement about what a project is trying to do. Balaji’s model gives a recognized founder a central role. The case for coordination deserves a fair hearing before evaluating its limits. [Reading: Balaji’s roadmap.] Original design question: which decisions need speed, and which need broad consent?' },
      { title: 'Exit and voice', explanation: 'Exit means leaving; voice means trying to change a decision while remaining. They solve different problems. Consider a fictional member whose job, housing, and friendships all depend on one community. Permission to leave does not tell us the cost of leaving. Evaluate money, mobility, safety, and access to alternatives separately from the written membership terms.' },
      { title: 'Authority that can change', explanation: 'Vitalik argues for a transition toward community participation rather than permanent founder dominance. Modular Politics proposes composable governance tools, including mechanisms missing from many online platforms. Its abstract is a design proposal, not proof of superior outcomes. [Readings: Vitalik; Modular Politics.] Original exercise: specify who can appeal a decision, who hears it, and who can remove an official.' },
    ],
    practicalExample: 'Fictional scenario: a founder doubles the workshop fee after members relocate. Compare three designs: leave immediately, vote on the budget, or challenge the change before an independent panel. Identify what each option can and cannot remedy.',
    quickActions: ['Read Vitalik’s founder-control discussion', 'Read the Modular Politics abstract and identify one governance mechanism', 'Draft a rule for removing a leader, including an appeal process'],
    summary: 'Exit, participation, and review are distinct safeguards. A useful charter explains how power can be challenged and transferred.',
    quiz: [
      { question: 'Which action is an example of voice rather than exit?', options: ['Moving out', 'Cancelling membership', 'Joining a different group', 'Proposing a budget amendment while remaining a member'], correctIndex: 3, explanation: 'Voice seeks change inside the organization; the other options leave it.' },
      { question: 'What must be examined beyond a formal right to leave?', options: ['Only the logo', 'Practical costs and available alternatives', 'Only the founder’s popularity', 'Nothing else'], correctIndex: 1, explanation: 'A written option can be difficult to use when housing, income, or mobility depend on staying.' },
      { question: 'What does the reviewed Modular Politics abstract offer?', options: ['Guaranteed outcomes', 'A direct review of Balaji’s later book', 'A framework for composable governance mechanisms', 'Evidence that voting never fails'], correctIndex: 2, explanation: 'The paper proposes a governance framework and predates the book; it does not prove universal results.' },
    ],
    sources: [proposal, review, modular],
  },
  {
    module: {
      id: 'network-states-inclusion', title: 'Freedom for Whom?',
      description: 'Examine access, member consent, neighboring communities, and who bears the costs of an experiment.',
      whyItMatters: 'A project can help participants while leaving important questions about everyone else unanswered.',
      objectives: ['Distinguish formal access from practical access', 'Identify affected nonmembers', 'Propose measurable inclusion safeguards'],
      estimatedMinutes: 15, difficulty: 'intermediate', tags: ['network-states', 'governance', 'community', 'decentralization'],
    },
    intro: 'Voluntary communities can make cooperation easier. Evaluating them also means asking who can join, who cannot leave, and who is affected without joining.',
    concepts: [
      { title: 'The appeal of association', explanation: 'Balaji’s essay argues for building new communities around shared goals rather than only competing to change existing institutions. Pooling effort can help a group attempt things individuals cannot do alone. That is a case for experimentation, not proof that every experiment benefits everyone. [Reading: Balaji’s essay.]' },
      { title: 'Access has several dimensions', explanation: 'Vitalik asks whether the model will primarily serve wealthy, mobile people. [Reading: Vitalik’s review.] Original evaluation exercise: list the price of membership, moving costs, visa constraints, accessibility needs, and obligations to dependents. An open application form answers only one part of whether someone can realistically participate. Check outcomes by group rather than relying on an inclusive mission statement.' },
      { title: 'Look beyond the membership', explanation: 'The written introduction to De Filippi and The Blockchain Socialist’s series contrasts exit-oriented autonomy with commons-oriented interdependence. This lesson uses that written framing; the episode audio has not been reviewed. [Reading: episode introduction.] Original exercise: map workers, neighbors, tenants, and service providers alongside members. Their interests should be investigated rather than assumed to match either supporters’ or critics’ expectations.' },
    ],
    practicalExample: 'Fictional scenario: a remote-work group funds a shared building. Members value its workspaces. Ask local renters, staff, and neighbors about costs and benefits, then decide what data would test those accounts. Do not assume a hypothetical impact has been observed at a real development.',
    quickActions: ['Compare the inclusion questions in Vitalik’s review with the proposal', 'Read the critical series’ written introduction and note its standpoint', 'Draw a stakeholder map and choose one measurable benefit and one possible cost'],
    summary: 'Member consent does not establish nonmember consent. Test access and local impact instead of inferring them from intentions.',
    quiz: [
      { question: 'If every member agrees, what can we infer about affected nonmembers?', options: ['Their consent has not been established', 'They all agree', 'They all oppose the project', 'They cannot be affected'], correctIndex: 0, explanation: 'The views of participants do not establish the views or interests of people outside the membership.' },
      { question: 'Which evidence best tests practical access?', options: ['A welcoming slogan alone', 'The number of promotional posts', 'The founder’s stated intention alone', 'Participation costs and barriers for different groups'], correctIndex: 3, explanation: 'Practical access requires examining barriers, not just whether a project describes itself as open.' },
      { question: 'What portion of the critical podcast resource supports this lesson?', options: ['A verified full audio transcript', 'Its accessible written introduction', 'An unpublished interview', 'Every episode in the series'], correctIndex: 1, explanation: 'Only the written introduction was reviewed; specific claims from the audio require further verification.' },
    ],
    sources: [essay, review, commons],
  },
  {
    module: {
      id: 'network-states-alternatives', title: 'Build New Systems, Improve Existing Ones, or Both?',
      description: 'Compare startup societies, commons-oriented approaches, and participatory governance through a fictional charter exercise.',
      whyItMatters: 'Criticism becomes more useful when it leads to concrete alternatives and testable tradeoffs.',
      objectives: ['Compare institutional design choices', 'Distinguish a proposal from evidence of success', 'Draft safeguards and identify unresolved tradeoffs'],
      estimatedMinutes: 18, difficulty: 'advanced', tags: ['network-states', 'governance', 'decentralization', 'community'],
    },
    intro: 'There are more than two positions: endorse the whole proposal or reject all experiments. Compare designs, identify assumptions, and write rules you could actually evaluate.',
    concepts: [
      { title: 'Compare mechanisms, not labels', explanation: 'Use Balaji’s online-to-offline pathway, the critical introduction’s commons framing, and Modular Politics’ governance framework as distinct starting points. They are not three proven products with comparable performance scores. [Readings: roadmap; critical introduction; Modular Politics abstract.] Original exercise: compare how each proposed design would make decisions, fund shared work, and resolve a dispute.' },
      { title: 'Specify a hybrid', explanation: 'A fictional community could experiment with shared services while retaining member review and cooperating with neighboring institutions. This is a classroom design option, not a claim about a current project. Write down which matters members control and which require agreement with others. Then identify a conflict the charter does not resolve. Acknowledging a limit makes the design easier to assess.' },
      { title: 'What would change your mind?', explanation: 'Before choosing a design, specify what success and failure would look like. Measure service reliability, affordability, participation, dispute resolution, and effects on outsiders. Compare results with the project’s stated baseline. A popular leader or rising asset price is not a substitute for every outcome. Distinguish your preference for a goal from evidence that a mechanism achieves it.' },
    ],
    practicalExample: 'Fictional capstone: draft a charter for the repair club. Include admission, fees, budgets, leadership succession, independent appeals, data privacy, exit, and neighboring residents’ input. Give the strongest objection to your own design and state what evidence would lead you to revise it.',
    quickActions: ['Compare the linked proposal, critical introduction, and governance abstract', 'Write a one-page charter with a leadership transition rule', 'Ask a peer to identify an affected person your charter overlooks'],
    summary: 'Judge a design by its mechanisms, evidence, and unresolved tradeoffs. Reasoned disagreement is a learning outcome; ideological agreement is not required.',
    quiz: [
      { question: 'Which is a testable governance safeguard?', options: ['Our founder will always be good', 'Everyone will agree forever', 'A defined appeal process with a reviewer and deadline', 'Our token must rise'], correctIndex: 2, explanation: 'A defined review procedure can be inspected and evaluated. The other statements assume outcomes.' },
      { question: 'What distinguishes a proposed framework from demonstrated results?', options: ['A framework describes mechanisms; outcomes need evidence', 'A framework guarantees success', 'A proposal is automatically a failed experiment', 'Evidence is unnecessary if the goal is good'], correctIndex: 0, explanation: 'A mechanism can be plausible without having comparative outcome evidence; testing is a separate step.' },
      { question: 'What should this course assess?', options: ['Agreement with Balaji', 'Agreement with every critic', 'A preferred political identity', 'Accurate explanations, fair objections, and evidence-based reasoning'], correctIndex: 3, explanation: 'Assessment checks understanding and reasoning, while reflection permits disagreement about values and priorities.' },
    ],
    sources: [proposal, essay, commons, modular, review],
  },
];

export const NETWORK_STATE_PLAN = {
  track: 'decentralization' as const,
  level: 'beginner' as const,
  summary: 'Network States: understand the proposal, examine counterpoints, and compare alternatives. Four courses from beginner to advanced; agreement with any author is not required.',
  modules: NETWORK_STATE_CURRICULUM.map(({ module }) => module),
};
