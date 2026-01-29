import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log('🔧 Database initialization:');
console.log('  SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
console.log('  SUPABASE_KEY:', supabaseKey ? 'SET (length: ' + supabaseKey.length + ')' : 'MISSING');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ CRITICAL: SUPABASE_URL and SUPABASE_KEY must be set in environment variables');
  throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface BotReply {
  id: string;
  parent_hash: string;
  reply_hash: string;
  command_type: string;
  reply_text: string;
  created_at: string;
}

export class BotReplyService {
  // Check if bot has already replied to a specific parent hash
  static async hasRepliedTo(parentHash: string): Promise<boolean> {
    try {
      console.log(`🔍 DB check for ${parentHash.slice(0, 10)}...`);
      const { data, error } = await supabase
        .from('bot_replies')
        .select('id')
        .eq('parent_hash', parentHash)
        .maybeSingle();
      
      if (error) {
        console.error('❌ Error checking bot reply:', error);
        console.error('   Error details:', JSON.stringify(error));
        return false; // On error, allow the reply to prevent blocking
      }
      
      const hasReplied = !!data;
      console.log(`   Result: ${hasReplied ? '✓ ALREADY REPLIED' : '✗ NEW (not in DB)'}`);
      return hasReplied;
    } catch (error) {
      console.error('💥 Exception checking bot reply:', error);
      return false; // On exception, allow the reply
    }
  }
  
  // Record a bot reply
  static async recordReply(
    parentHash: string, 
    replyHash: string, 
    commandType: string = 'mention', 
    replyText: string = ''
  ): Promise<void> {
    try {
      console.log(`💾 Recording reply: parent=${parentHash.slice(0, 10)}, reply=${replyHash.slice(0, 10)}`);
      const { error } = await supabase
        .from('bot_replies')
        .insert([{
          parent_hash: parentHash,
          reply_hash: replyHash,
          command_type: commandType,
          reply_text: replyText
        }]);
      
      if (error) {
        // Check if it's a duplicate key error (already exists)
        if (error.code === '23505') {
          console.log(`⚠️ Reply already recorded for parent ${parentHash.slice(0, 10)}`);
        } else {
          console.error('❌ Error recording bot reply:', error);
          console.error('   Error details:', JSON.stringify(error));
        }
      } else {
        console.log(`✅ DB: Successfully recorded reply for parent ${parentHash.slice(0, 10)}`);
      }
    } catch (error) {
      console.error('💥 Exception recording bot reply:', error);
      console.error('   Exception details:', error);
    }
  }
}

// Search for Farcaster casts by keyword
export async function searchCasts(query: string, limit: number = 10): Promise<any> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) throw new Error('NEYNAR_API_KEY not configured');

  const url = `https://api.neynar.com/v2/farcaster/cast/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  
  const response = await fetch(url, {
    headers: {
      'accept': 'application/json',
      'api_key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Neynar API error: ${response.status}`);
  }

  const data: any = await response.json();
  return data.casts || [];
}

// Get recent casts from a specific user by username
export async function getCastsByUsername(username: string, limit: number = 25): Promise<any> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) throw new Error('NEYNAR_API_KEY not configured');

  // First, look up the user to get their FID
  const userUrl = `https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`;
  const userResponse = await fetch(userUrl, {
    headers: {
      'accept': 'application/json',
      'api_key': apiKey,
    },
  });

  if (!userResponse.ok) {
    throw new Error(`Failed to fetch user ${username}: ${userResponse.status}`);
  }

  const userData: any = await userResponse.json();
  const fid = userData.result?.user?.fid;
  
  if (!fid) {
    throw new Error(`User ${username} not found`);
  }

  // Now fetch their casts
  const castsUrl = `https://api.neynar.com/v2/farcaster/feed/user/${fid}/casts?limit=${limit}`;
  const castsResponse = await fetch(castsUrl, {
    headers: {
      'accept': 'application/json',
      'api_key': apiKey,
    },
  });

  if (!castsResponse.ok) {
    throw new Error(`Failed to fetch casts: ${castsResponse.status}`);
  }

  const castsData: any = await castsResponse.json();
  return castsData.casts || [];
}
