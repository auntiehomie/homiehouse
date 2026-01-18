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
  // Returns true if record was successfully created, false if it already exists
  static async recordReply(
    parentHash: string, 
    replyHash: string, 
    commandType: string = 'mention', 
    replyText: string = ''
  ): Promise<boolean> {
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
          return false; // Record already exists
        } else {
          console.error('❌ Error recording bot reply:', error);
          console.error('   Error details:', JSON.stringify(error));
          return false; // Error occurred
        }
      } else {
        console.log(`✅ DB: Successfully recorded reply for parent ${parentHash.slice(0, 10)}`);
        return true; // Successfully created
      }
    } catch (error) {
      console.error('💥 Exception recording bot reply:', error);
      console.error('   Exception details:', error);
      return false; // Exception occurred
    }
  }
  
  // Update an existing bot reply record
  static async updateReply(
    parentHash: string, 
    replyHash: string, 
    replyText: string = ''
  ): Promise<void> {
    try {
      console.log(`🔄 Updating reply record: parent=${parentHash.slice(0, 10)}`);
      const { data, error, count } = await supabase
        .from('bot_replies')
        .update({
          reply_hash: replyHash,
          reply_text: replyText
        })
        .eq('parent_hash', parentHash)
        .select();
      
      if (error) {
        console.error('❌ Error updating bot reply:', error);
        console.error('   Error details:', JSON.stringify(error));
      } else if (!data || data.length === 0) {
        console.warn(`⚠️ No record found to update for parent ${parentHash.slice(0, 10)}`);
      } else {
        console.log(`✅ DB: Successfully updated reply for parent ${parentHash.slice(0, 10)}`);
      }
    } catch (error) {
      console.error('💥 Exception updating bot reply:', error);
      console.error('   Exception details:', error);
    }
  }
}
