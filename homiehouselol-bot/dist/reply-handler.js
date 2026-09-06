import fs from 'fs/promises';
import path from 'path';
const botPersonality = await fs.readFile(path.join(path.dirname(import.meta.url), 'homiehouselol-persona.txt'), 'utf-8');
let repliedCasts = new Set();
export async function loadRepliedCasts() {
    try {
        const file = path.join(path.dirname(import.meta.url), '..', 'replied_casts.json');
        const data = await fs.readFile(file, 'utf-8');
        const casts = JSON.parse(data);
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recent = casts.filter(c => c.timestamp > oneWeekAgo);
        await fs.writeFile(file, JSON.stringify(recent, null, 2));
        return new Set(recent.map(c => c.hash));
    }
    catch (err) {
        console.log('No reply cache found, starting fresh');
        return new Set();
    }
}
export async function saveReplied(hash) {
    const file = path.join(path.dirname(import.meta.url), '..', 'replied_casts.json');
    try {
        const data = await fs.readFile(file, 'utf-8');
        const casts = JSON.parse(data);
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recent = casts.filter(c => c.timestamp > oneWeekAgo);
        recent.push({ hash, timestamp: Date.now() });
        await fs.writeFile(file, JSON.stringify(recent, null, 2));
    }
    catch {
        await fs.writeFile(file, JSON.stringify([{ hash, timestamp: Date.now() }], null, 2));
    }
}
export async function handleMention(farcasterClient, anthropic, castText, castingFid, replyToHash, appFid) {
    // Check if we already replied
    if (repliedCasts.has(replyToHash)) {
        console.log('Already replied to this cast');
        return;
    }
    console.log(`Replying to @mention from FID ${castingFid}`);
    console.log(`Cast text: ${castText}`);
    // Extract question/context (removing the @mention itself)
    const cleanedText = castText.replace(/@homiehouselol/g, '').trim();
    // Query knowledge base (placeholder - will implement Supabase later)
    // For now, we'll generate response directly from personality + context
    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: 200,
            system: `You are @homiehouselol, a helpful midwestern buddy on Farcaster.\n\n${botPersonality}\n\nRespond to this cast mention. Keep it conversational, helpful, and under 280 characters.`,
            messages: [
                {
                    role: 'user',
                    content: cleanedText || 'Hey homie, got any tips for a new Farcaster user!'
                }
            ]
        });
        const botReply = response.content[0].text;
        // Post the reply
        await farcasterClient.publishCast({
            fid: appFid,
            text: botReply,
            reply_to: {
                hash: replyToHash,
                root_hash: replyToHash
            }
        });
        repliedCasts.add(replyToHash);
        await saveReplied(replyToHash);
        console.log(`✅ Replied: ${botReply}`);
    }
    catch (err) {
        console.error('Failed to generate reply:', err);
    }
}
