import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
dotenv.config();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SIGNER_PRIVATE_KEY_HEX = process.env.SIGNER_PRIVATE_KEY_HEX;
const APP_FID = process.env.APP_FID || '1349780';
if (!ANTHROPIC_API_KEY || !SIGNER_PRIVATE_KEY_HEX) {
    throw new Error('Missing env vars: ANTHROPIC_API_KEY, SIGNER_PRIVATE_KEY_HEX');
}
// Warpcast API endpoints (FREE, no third-party SDK needed)
const WARPCAST_API = 'https://hub.warpcast.com';
let repliedCasts = new Set();
async function loadRepliedCasts() {
    try {
        const file = 'replied_casts.json';
        const data = await fs.readFile(file, 'utf-8');
        const casts = JSON.parse(data);
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recent = casts.filter(c => c.timestamp > oneWeekAgo);
        await fs.writeFile(file, JSON.stringify(recent, null, 2));
        return new Set(recent.map(c => c.hash));
    }
    catch {
        return new Set();
    }
}
// Sign and publish cast using your signer
// This uses the Warpcast API directly
async function publishCast(signers, fid, text, parentHash) {
    console.log(`Publishing cast: ${text.substring(0, 60)}...`);
    // Use Warpcast's API to publish
    const response = await fetch(`${WARPCAST_API}/add_cast`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fid,
            text,
            parent_hash: parentHash || null,
            signer_hex: signers.public_key_hex,
            timestamp: Math.floor(Date.now() / 1000),
        })
    });
    const result = await response.json();
    if (result.hash) {
        console.log('✅ Cast published:', result.hash);
        return result.hash;
    }
    else {
        throw new Error(`Failed to publish: ${JSON.stringify(result)}`);
    }
}
async function handleMention(castText, parentCastHash) {
    const cleanedText = castText.replace(/@homiehouselol/g, '').trim();
    const botPersonality = await fs.readFile(path.join(__dirname, 'homiehouselol-persona.txt'), 'utf-8');
    const botReply = await generateBotResponse(cleanedText, botPersonality);
    try {
        await publishCast({ private_key_hex: SIGNER_PRIVATE_KEY_HEX, public_key_hex: '0x...' }, parseInt(APP_FID), botReply, parentCastHash);
        repliedCasts.add(parentCastHash);
        const file = 'replied_casts.json';
        const casts = Array.from(repliedCasts).map(h => ({
            hash: h,
            timestamp: Date.now()
        }));
        await fs.writeFile(file, JSON.stringify(casts, null, 2));
        console.log(`✅ Replied: ${botReply}`);
    }
    catch (err) {
        console.error('Failed to post reply:', err);
    }
}
async function generateBotResponse(question, persona) {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 200,
        system: `You are @homiehouselol, a helpful midwestern buddy on Farcaster.\n\n${persona}\n\nRespond to this question as @homiehouselol. Keep it conversational, helpful, and under 280 characters.`,
        messages: [{
                role: 'user',
                content: question || 'Hey homie, got any tips for a new Farcaster user!'
            }]
    });
    const content = response.content[0];
    return typeof content === 'object' && 'text' in content
        ? content.text.trim()
        : '';
}
// Poll for new mentions
async function startBot() {
    console.log('🤖 Starting @homiehouselol bot');
    console.log('Polling every 60s for @mentions...');
    fetchMentions();
    setInterval(fetchMentions, 60000);
}
async function fetchMentions() {
    try {
        // Search using Warpcast API
        const response = await fetch(`https://www.warpcast.com/~/api/v2/search?q=@homiehouselol&limit=10&sort=Latest&cursor=`);
        const data = await response.json();
        if (data.casts?.length > 0) {
            for (const cast of data.casts) {
                const parentHash = cast.cast_info?.hash || cast.hash;
                if (!repliedCasts.has(parentHash)) {
                    console.log(`Found mention: ${cast.cast_info?.text?.substring(0, 50)}...`);
                    await handleMention(cast.cast_info?.text || '', parentHash);
                }
            }
        }
    }
    catch (err) {
        console.error('Error fetching mentions:', err);
    }
}
startBot().catch(console.error);
