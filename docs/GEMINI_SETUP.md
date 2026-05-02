# Add to Render Environment Variables

Add this new variable to your homiehouse service on Render:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

## How it works now:

**When external links are present:**
1. 🌐 **Gemini 2.0 Flash** processes the links with its web access capabilities
2. Bot can understand article content, webpage context, and current information
3. Responds naturally based on what the link is about

**When images are present:**
- 🖼️ **GPT-4o Vision** analyzes images and responds

**For text only:**
- 💬 **Claude 3.5 Sonnet** generates natural responses

The bot now has full web access through Gemini when links are shared!
