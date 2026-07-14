import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';
dotenv.config();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SIGNER_PRIVATE_KEY_HEX = process.env.SIGNER_PRIVATE_KEY_HEX;
const SIGNER_PUBLIC_KEY_HEX = process.env.SIGNER_PUBLIC_KEY_HEX;
const APP_FID = process.env.APP_FID || '1349780';
if (!ANTHROPIC_API_KEY || !SIGNER_PRIVATE_KEY_HEX || !SIGNER_PUBLIC_KEY_HEX) {
    throw new Error('Missing env vars: ANTHROPIC_API_KEY, SIGNER_PRIVATE_KEY_HEX, SIGNER_PUBLIC_KEY_HEX, APP_FID');
}
let repliedCasts = new Set();
async function loadRepliedCasts() {
    try {
        const file = path.join(__dirname, '..', 'replied_casts.json');
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
async function loadPersona() {
    return await fs.readFile(path.join(__dirname, 'homiehouselol-persona.txt'), 'utf-8');
}
async function publishCast(fid, text, parentHash) {
    console.log('📝 Publishing cast to FID ' + fid + ': ' + text.substring(0, 60));
    const response = await fetch('https://hub.warpcast.com/add_cast', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fid,
            text,
            parent_hash: parentHash || null,
            signer_hex: SIGNER_PUBLIC_KEY_HEX,
            timestamp: Math.floor(Date.now() / 1000),
        })
    });
    const result = await response.json();
    if (result.hash) {
        console.log('✅ Cast published:', result.hash);
        return result.hash;
    }
    else {
        throw new Error('Failed to publish: ' + JSON.stringify(result));
    }
}
async function handleMention(castText, parentCastHash) {
    const cleanedText = castText.replace(/@homiehouselol/g, '').trim();
    console.log('Processing mention: ' + cleanedText);
    const persona = await loadPersona();
    const botReply = await generateBotResponse(cleanedText, persona);
    try {
        await publishCast(parseInt(APP_FID), botReply, parentCastHash);
        repliedCasts.add(parentCastHash);
        const file = path.join(__dirname, '..', 'replied_casts.json');
        const casts = Array.from(repliedCasts).map(h => ({ hash: h, timestamp: Date.now() }));
        await fs.writeFile(file, JSON.stringify(casts, null, 2));
        console.log('✅ Replied:', botReply);
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
        system: 'You are @homiehouselol on Farcaster. ' + persona + '\n\nRespond to this question. Keep it direct, helpful, 180-250 chars max.',
        messages: [{
                role: 'user',
                content: question || 'Got any tips for new Farcaster users?'
            }]
    });
    const content = response.content[0];
    if (typeof content === 'object' && 'text' in content) {
        return content.text.trim();
    }
    return 'Thanks for asking - I am @homiehouselol and I help with Farcaster/crypto/AI questions.';
}
async function startBot() {
    repliedCasts = await loadRepliedCasts();
    console.log('🤖 @homiehouselol bot running on FID ' + APP_FID);
    console.log('Polling every 60s for @mentions...\n');
    const poll = async () => {
        try {
            const response = await fetch('https://www.warpcast.com/~/api/v2/search?q=@homiehouselol&limit=5&sort=Latest');
            const data = await response.json();
            if (data.casts?.length > 0) {
                for (const cast of data.casts) {
                    const hash = cast.cast_info?.hash || cast.hash;
                    const text = cast.cast_info?.text;
                    if (text && !repliedCasts.has(hash)) {
                        await handleMention(text, hash);
                    }
                }
            }
        }
        catch (err) {
            console.error('Error polling:', err);
        }
        setTimeout(poll, 60000);
    };
    poll();
}
startBot().catch(console.error);
