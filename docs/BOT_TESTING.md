# Testing Bot Feed Intelligence

## Quick Test Guide

### 1. Start the Bot Server

```bash
cd server
npm start
```

The bot will run on a 15-minute cron schedule, or you can manually trigger it.

### 2. Test Scenarios

#### Scenario 1: Simple Topic Question

**On Farcaster:**
```
@homiehouse what's worldcoin?
```

**Expected Behavior:**
- ✅ Bot searches for recent casts about "worldcoin"
- ✅ Gets trending discussions
- ✅ Fetches real-time info via Perplexity
- ✅ Responds with detailed, contextual answer

**Check Logs For:**
```
🌐 Getting Farcaster feed context for smarter response...
✓ Enhanced with Farcaster feed intelligence
🔎 Searching casts for: worldcoin
🔍 Using Perplexity for in-depth research...
```

#### Scenario 2: Channel Context

**On Farcaster in /crypto:**
```
@homiehouse thoughts on this?
```

**Expected Behavior:**
- ✅ Reads recent /crypto channel activity
- ✅ Understands current topics in the channel
- ✅ Provides channel-relevant response

**Check Logs For:**
```
🔍 Fetching context for channel: crypto
✓ Channel /crypto context loaded
CHANNEL /crypto CONTEXT:
- Current topics: bitcoin, ethereum, trading, defi
```

#### Scenario 3: Trending Topics

**On Farcaster:**
```
@homiehouse what's trending today?
```

**Expected Behavior:**
- ✅ Gets feed intelligence with trending topics
- ✅ Provides summary of current discussions

**Check Logs For:**
```
🌐 Fetching feed intelligence from Farcaster...
✓ Feed intelligence cached: 10 trending topics
CURRENT FARCASTER CONTEXT:
- Trending: worldcoin, bitcoin, base, ai, degen, music
```

#### Scenario 4: Casual Chat (No Intelligence)

**On Farcaster:**
```
@homiehouse hey
```

**Expected Behavior:**
- ✅ Quick response without heavy intelligence
- ✅ Matches casual tone
- ✅ No feed searches

**Check Logs For:**
```
💭 Generating reply for cast...
(Should NOT see "Getting Farcaster feed context")
```

### 3. Monitor Performance

#### Response Times

| Query Type | Expected Time | Intelligence Used |
|------------|---------------|-------------------|
| Casual chat | 2-3s | Minimal |
| Questions | 4-6s | Full |
| Channel mentions | 3-5s | Channel context |
| Images | 3-4s | Vision + context |

#### Cache Behavior

**First run (no cache):**
```
🌐 Fetching feed intelligence from Farcaster...
✓ Feed intelligence cached: 10 trending topics
```

**Second run within 15 minutes (cached):**
```
(No fetching message - uses cached data)
```

### 4. Verify Intelligence Features

#### Feed Intelligence ✓
```bash
# Check if trending topics are being cached
# Look for: "Feed intelligence cached: X trending topics"
```

#### Channel Context ✓
```bash
# Mention bot in different channels
# Verify logs show: "Fetching context for channel: [channel_name]"
```

#### User Network ✓
```bash
# Different users mention bot
# Logs should show: "Analyzing network for FID [fid]"
```

#### Cast Search ✓
```bash
# Ask about specific topics
# Verify: "Searching casts for: [topic]"
```

### 5. Test API Integration

#### Manual API Test

Create `test-feed-intelligence.js`:

```javascript
import { getFeedIntelligence, getChannelContext, searchRelevantCasts } from './src/feed-intelligence.js';

async function test() {
  console.log('Testing feed intelligence...\n');
  
  // Test 1: Feed intelligence
  console.log('1. Testing feed intelligence:');
  const feedContext = await getFeedIntelligence();
  console.log(feedContext);
  
  // Test 2: Channel context
  console.log('\n2. Testing channel context:');
  const channelContext = await getChannelContext('crypto');
  console.log(channelContext);
  
  // Test 3: Cast search
  console.log('\n3. Testing cast search:');
  const searchContext = await searchRelevantCasts('worldcoin');
  console.log(searchContext);
  
  console.log('\n✅ All tests complete');
}

test().catch(console.error);
```

Run:
```bash
cd server
node test-feed-intelligence.js
```

### 6. Debugging Tips

#### Issue: Intelligence not activating

**Check:**
- Is the query a question? (contains `?`)
- Does it mention a topic keyword?
- Check `extractTopicFromText()` function

**Solution:**
```typescript
// Add more keywords to extractTopicFromText()
const topics = [
  'worldcoin', 'bitcoin', 'ethereum',
  'your-custom-topic' // Add here
];
```

#### Issue: API rate limit errors

**Check:**
```
Error: Farcaster API API rate limit exceeded
```

**Solution:**
- Increase cache TTL to reduce API calls
- Add exponential backoff
- Check your Farcaster API API plan limits

#### Issue: Slow responses

**Check logs for:**
```
⚠️ Perplexity timeout
⚠️ Channel context timeout
```

**Solution:**
- Reduce context sources
- Implement timeout thresholds
- Skip optional contexts

### 7. Production Monitoring

#### Key Metrics

```bash
# Intelligence activation rate
grep "Getting Farcaster feed context" server/logs/*.log | wc -l

# Cache hit rate  
grep "Feed intelligence cached" server/logs/*.log | wc -l

# Average response time
# Parse timestamps between "Generating reply" and "Posted reply"
```

#### Health Checks

```bash
# Check bot is responding
curl http://localhost:3001/health

# Check database connection
curl http://localhost:3001/api/bot/stats

# Check API keys are valid
# Look for authentication errors in logs
```

### 8. Example Test Session

```bash
# Terminal 1: Start server with verbose logs
cd server
DEBUG=* npm start

# Terminal 2: Watch bot activity
tail -f server/logs/bot.log

# Terminal 3: Test on Farcaster
# Go to warpcast.com and mention @homiehouse with test queries
```

### 9. Verification Checklist

Before deploying to production:

- [ ] Bot responds to mentions
- [ ] Feed intelligence activates for questions
- [ ] Channel context loads correctly
- [ ] Cast search returns results
- [ ] Cache is working (15 min TTL)
- [ ] No TypeScript errors
- [ ] API rate limits not exceeded
- [ ] Response times acceptable (<6s)
- [ ] Logs are clear and informative
- [ ] Error handling works (test with invalid inputs)

### 10. Troubleshooting Commands

```bash
# Check if bot server is running
ps aux | grep node | grep bot

# View recent bot activity
tail -n 100 server/logs/bot.log

# Check for errors
grep "Error" server/logs/bot.log

# Test Farcaster API API connection
curl -H "api_key: YOUR_KEY" https://api.farcaster-api.com/v2/farcaster/user/bulk?fids=1987078

# Clear cache (restart server)
pkill -f "node.*bot"
npm start
```

## Expected Output Examples

### Successful Intelligence Activation

```
🔔 Found 1 new mentions to process
💭 Generating reply for cast abc123...
🌐 Getting Farcaster feed context for smarter response...
🌐 Fetching feed intelligence from Farcaster...
✓ Feed intelligence cached: 8 trending topics
🔍 Fetching context for channel: crypto
✓ Channel /crypto context loaded
🔎 Searching casts for: worldcoin
✓ Enhanced with Farcaster feed intelligence
🔍 Using Perplexity for in-depth research...
✓ Perplexity research complete
✅ Posted reply to abc123: [detailed response]
```

### Cached Intelligence (Fast)

```
🔔 Found 1 new mentions to process
💭 Generating reply for cast def456...
🌐 Getting Farcaster feed context for smarter response...
(Uses cached data - no fetching message)
✓ Enhanced with Farcaster feed intelligence
✅ Posted reply to def456: [quick response]
```

### Casual Chat (No Intelligence)

```
🔔 Found 1 new mentions to process
💭 Generating reply for cast ghi789...
(No "Getting Farcaster feed context" message)
✅ Posted reply to ghi789: hey! 🏠
```

## Performance Benchmarks

Target response times:

- **Casual chat**: < 3 seconds
- **Questions with intelligence**: < 6 seconds  
- **Channel mentions**: < 5 seconds
- **Image analysis**: < 4 seconds

If exceeding these, check for:
- API timeouts
- Cache misses
- Network latency
- Too many context sources

## Success Criteria

✅ **Working correctly if:**
1. Bot responds to all mention types
2. Intelligence activates for questions/topics
3. Responses are contextually relevant
4. Cache reduces API calls
5. Response times are acceptable
6. No errors in production logs
7. Users report improved answer quality

🚨 **Issues if:**
1. Intelligence never activates
2. All responses take >10 seconds
3. API rate limit errors
4. Irrelevant or outdated context
5. Bot ignores channel/thread context
6. Cache never hits
7. Errors in every response

## Next Steps

After testing:

1. Deploy to production (Render)
2. Monitor for 24 hours
3. Collect user feedback
4. Adjust cache TTL if needed
5. Fine-tune topic keywords
6. Optimize performance bottlenecks
7. Add more intelligence sources (optional)

## Support

If tests fail:
1. Check [BOT_INTELLIGENCE.md](./BOT_INTELLIGENCE.md) for architecture
2. Review [AI_FRAMEWORK.md](./AI_FRAMEWORK.md) for AI config
3. Verify environment variables in `.env`
4. Check Farcaster API API status
5. Review server logs for specific errors
