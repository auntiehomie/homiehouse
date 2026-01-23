# HomieHouse AI Agent Framework

An intelligent, learning AI system that helps users create better Farcaster casts and improve their social presence through personalized coaching and analysis.

## Architecture

### Multi-Agent System

The framework uses specialized AI agents that work together:

1. **Cast Composer Agent** (`composer`) - Helps write engaging Farcaster casts
   - Generates 2-3 cast suggestions based on user input
   - Matches user's preferred writing style and tone
   - Provides reasoning for each suggestion
   - Offers actionable improvement tips

2. **Farcaster Coach Agent** (`coach`) - Provides learning and improvement feedback  
   - Analyzes cast quality and engagement potential
   - Identifies patterns in user's posting behavior
   - Generates personalized improvement insights
   - Tracks progress over time

3. **Research Agent** (`researcher`) - Helps with knowledge and context
   - Explains Farcaster concepts and terminology
   - Provides context about users and projects
   - Researches trending topics
   - Answers technical questions

4. **Agent Orchestrator** - Coordinates agents and manages workflow
   - Auto-detects user intent
   - Routes requests to appropriate agent
   - Maintains conversation context
   - Manages user profile and learning data

### Learning System

The framework learns from each interaction:

- **User Profile Tracking**
  - Writing style (casual, professional, technical, creative)
  - Preferred tone (friendly, informative, humorous, serious)
  - Cast length preferences
  - Emoji and hashtag usage
  - Topics of interest

- **Pattern Recognition**
  - Analyzes previous casts to identify successful patterns
  - Tracks cast length, emoji usage, question frequency, link sharing
  - Builds understanding of what works for each user

- **Feedback Loop**
  - Collects user feedback on suggestions (👍 👎)
  - Stores feedback history for continuous improvement
  - Adjusts future recommendations based on past preferences

### Memory & Context

- **Conversation Memory**: Maintains context within conversations using LangChain's BufferMemory
- **User Profile Storage**: Persists user preferences and learning data (currently in-memory, can be upgraded to database)
- **Feedback History**: Stores up to 20 recent feedback items per user
- **Cast History**: Tracks last 50 casts per user for pattern analysis

## Usage

### Basic Chat

```typescript
import { AgentOrchestrator } from '@/lib/ai/agents';
import { UserProfileStorage } from '@/lib/ai/storage';

// Get user profile
const profile = UserProfileStorage.getProfile('user123');

// Create orchestrator
const orchestrator = new AgentOrchestrator(profile);

// Process request (auto-detects intent)
const result = await orchestrator.processRequest(
  "Help me write a cast about Farcaster"
);

console.log(result.content); // AI response
console.log(result.suggestions); // Cast suggestions
console.log(result.role); // Which agent responded
```

### Specific Agent Modes

```typescript
// Force compose mode
const composeResult = await orchestrator.processRequest(
  "web3 social networks",
  'compose'
);

// Force analyze mode
const analyzeResult = await orchestrator.processRequest(
  "Just shipped a new feature! 🚀",
  'analyze'
);

// Force learn mode
const learnResult = await orchestrator.processRequest(
  "How can I improve my engagement?",
  'learn'
);

// Force research mode
const researchResult = await orchestrator.processRequest(
  "What are Farcaster Frames?",
  'research'
);
```

### Managing User Profiles

```typescript
// Update profile
UserProfileStorage.updateProfile('user123', {
  writingStyle: 'technical',
  preferredTone: 'informative',
  useEmojis: false
});

// Add cast to history
UserProfileStorage.addCast('user123', 'My new cast content');

// Add feedback
UserProfileStorage.addFeedback('user123', 'cast text', 'helpful');

// Get stats
const stats = UserProfileStorage.getStats('user123');
console.log(stats.totalCasts); // Number of tracked casts
console.log(stats.patterns); // Identified patterns
```

## API Endpoints

### POST `/api/ask-homie`

Main chat endpoint with agent support.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Help me write a cast" }
  ],
  "mode": "agent",
  "userId": "user123",
  "intent": "compose",
  "castContext": {
    "author": "username",
    "text": "Original cast text"
  },
  "feedback": {
    "cast": "Previous cast",
    "feedback": "helpful"
  }
}
```

**Response:**
```json
{
  "response": "AI response text",
  "suggestions": ["Cast option 1", "Cast option 2"],
  "agentRole": "composer",
  "metadata": {
    "tips": ["Tip 1", "Tip 2"]
  },
  "mode": "agent",
  "userStats": {
    "totalCasts": 10,
    "totalFeedback": 5,
    "patterns": ["Tends to write short casts"]
  }
}
```

### PATCH `/api/ask-homie`

Update user profile.

**Request:**
```json
{
  "userId": "user123",
  "updates": {
    "writingStyle": "casual",
    "preferredTone": "friendly"
  }
}
```

### GET `/api/ask-homie?userId=user123`

Get user profile and stats.

## UI Components

### AgentChat Component

Full-featured chat interface with mode selection, settings, and suggestion handling.

```tsx
import AgentChat from '@/components/AgentChat';

<AgentChat
  userId="user123"
  castContext={{ author: "username", text: "cast text" }}
  onCastSelect={(cast) => {
    // Handle cast selection
    navigator.clipboard.writeText(cast);
  }}
/>
```

**Features:**
- Mode selector (compose, analyze, learn, research, auto)
- User settings panel for preferences
- Cast suggestions with copy/feedback buttons  
- User stats display
- Conversation history
- Context awareness

## Intent Detection

The system auto-detects user intent based on keywords:

- **Compose**: "write", "compose", "create a cast", "help me post"
- **Analyze**: "analyze", "feedback on", "review this", "thoughts on"
- **Learn**: "improve", "better at", "learn", "tips", "advice"
- **Research**: "what is", "who is", "explain", "tell me about"

## Extensibility

### Adding New Agents

1. Create agent class extending `BaseAgent`:

```typescript
export class NewAgent extends BaseAgent {
  constructor() {
    super('anthropic', 'Your system prompt');
  }

  async doSomething(input: string): Promise<string> {
    return this.chat(input);
  }
}
```

2. Add to orchestrator:

```typescript
private newAgent: NewAgent;

constructor(userProfile: UserProfile) {
  // ...
  this.newAgent = new NewAgent();
}
```

### Custom Storage Backend

Replace in-memory storage with database:

```typescript
export class DatabaseUserProfileStorage {
  static async getProfile(userId: string): Promise<UserProfile> {
    // Fetch from database
  }

  static async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    // Update in database
  }
}
```

## Configuration

Required environment variables:

```bash
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

Optional:
```bash
AI_PROVIDER=anthropic  # or 'openai'
```

## Future Enhancements

- [ ] Database integration for persistent storage
- [ ] Multi-user conversation threads  
- [ ] Cast performance tracking integration
- [ ] Advanced pattern recognition with ML
- [ ] Voice input support
- [ ] Image analysis for cast media
- [ ] Integration with Farcaster analytics
- [ ] Export learning insights as reports
- [ ] Team collaboration features
- [ ] A/B testing for cast variations

## Credits

Built with:
- [LangChain](https://langchain.com) - Agent framework
- [Anthropic Claude](https://anthropic.com) - Primary LLM
- [OpenAI GPT](https://openai.com) - Fallback LLM  
- [Zod](https://zod.dev) - Schema validation
