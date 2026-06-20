# HomieHouse Documentation

Welcome to the HomieHouse documentation! This directory contains all the detailed guides and technical documentation for the project.

## Quick Start Guides

Get up and running quickly with these guides:

- **[Curation Setup](./CURATION_SETUP.md)** - Set up feed curation in 5 steps
- **[Notifications Quickstart](./NOTIFICATIONS_QUICKSTART.md)** - Get started with notifications

## Feature Documentation

### Feed Curation

The feed curation system allows users to customize their feed with advanced filters:

- **[Curation Guide](./CURATION_GUIDE.md)** - Complete guide to feed curation
  - How curation works
  - Preference types (keywords, channels, authors, content types)
  - Priority system
  - Example use cases
  - Best practices

- **[Curation Architecture](./CURATION_ARCHITECTURE.md)** - Technical implementation details
  - Component structure
  - Data flow diagrams
  - Database schema
  - Filter logic
  - API endpoints

### Notifications

The notifications system provides real-time updates on user interactions:

- **[Notifications Guide](./NOTIFICATIONS_GUIDE.md)** - Comprehensive notifications documentation
  - Notification types (follows, likes, recasts, replies, mentions)
  - Actor details and social stats
  - Filtering and organization
  - Real-time updates
  - Technical implementation

- **[Notifications Quickstart](./NOTIFICATIONS_QUICKSTART.md)** - Quick reference guide
  - How to use the interface
  - Filter tabs
  - Unread tracking
  - Testing guide
  - Troubleshooting

### AI Integration

- **[AI Framework](./AI_FRAMEWORK.md)** - AI-powered features documentation
  - Multiple LLM provider integration
  - Ask Homie assistant
  - Context management
  - Best practices

### Bot System

- **[Bot README](./BOT_README.md)** - Bot overview and architecture
- **[Bot Intelligence](./BOT_INTELLIGENCE.md)** - Farcaster bot intelligence system
  - Feed intelligence and context awareness
  - Channel and user network analysis
  - Real-time cast search
  - Performance optimization
  - Configuration and monitoring

- **[Bot Testing Guide](./BOT_TESTING.md)** - Testing feed intelligence features
  - Test scenarios and expected behavior
  - Performance monitoring
  - Debugging tips
  - Production checklist

- **[Smart Bot](./SMART_BOT.md)** - Advanced bot capabilities
- **[Context Sources](./CONTEXT_SOURCES.md)** - Bot context gathering system
- **[Bot Database Setup](./BOT_DATABASE_SETUP.md)** - Database configuration for bot
- **[Gemini Setup](./GEMINI_SETUP.md)** - Google Gemini AI configuration

## Setup & Deployment

Infrastructure and deployment documentation:

- **[Supabase Setup](./SUPABASE_SETUP.md)** - Database setup and configuration
  - Creating tables
  - Environment variables
  - Connection configuration

- **[Render Environment Setup](./RENDER_ENV_SETUP.md)** - Deploying to Render
  - Environment variable configuration
  - Deployment steps
  - Production setup

## Document Organization

```
docs/
├── README.md                        ← You are here
├── CURATION_SETUP.md               ← Quick setup guide
├── CURATION_GUIDE.md               ← Complete curation guide
├── CURATION_ARCHITECTURE.md        ← Technical architecture
├── NOTIFICATIONS_QUICKSTART.md     ← Quick start for notifications
├── NOTIFICATIONS_GUIDE.md          ← Complete notifications guide
├── AI_FRAMEWORK.md                 ← AI integration docs
├── BOT_README.md                   ← Bot overview
├── BOT_INTELLIGENCE.md             ← Bot feed intelligence system
├── BOT_TESTING.md                  ← Bot testing guide
├── BOT_DATABASE_SETUP.md           ← Bot database configuration
├── BOT_ENHANCEMENT_SUMMARY.md      ← Latest bot enhancements
├── SMART_BOT.md                    ← Advanced bot capabilities
├── CONTEXT_SOURCES.md              ← Bot context system
├── GEMINI_SETUP.md                 ← Gemini AI setup
├── QUICK_REFERENCE.md              ← Quick reference card
├── SUPABASE_SETUP.md               ← Database setup
└── RENDER_ENV_SETUP.md             ← Deployment configuration
```

## Contributing to Documentation

When adding new features:

1. Create documentation in this `docs/` directory
2. Use relative links for cross-references (e.g., `[Guide](./GUIDE.md)`)
3. Update this README.md with links to new docs
4. Update the main [README.md](../README.md) if needed

## Additional Resources

- [Main Project README](../README.md) - Project overview and setup
- [Server Documentation](../server/README.md) - Backend server details

## Questions or Issues?

If you find any documentation issues or have suggestions:
1. Check the specific guide for troubleshooting sections
2. Review related documentation
3. Check the browser console for errors
4. Verify environment variables are set correctly
