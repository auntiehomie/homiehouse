import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export interface CuratedList {
  id?: number;
  fid: number;
  list_name: string;
  description?: string;
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CuratedListItem {
  id?: number;
  list_id: number;
  cast_hash: string;
  cast_author_fid?: number;
  cast_text?: string;
  cast_timestamp?: string;
  added_by_fid: number;
  notes?: string;
  created_at?: string;
}

export interface BotConversation {
  id?: number;
  user_fid: number;
  conversation_type: string;
  state: string;
  context_data?: any;
  parent_cast_hash?: string;
  last_interaction_at?: string;
  created_at?: string;
  expires_at?: string;
}

export class CuratedListService {
  // Get all lists for a user
  static async getUserLists(fid: number): Promise<CuratedList[]> {
    try {
      const { data, error } = await supabase
        .from('curated_lists')
        .select('*')
        .eq('fid', fid)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching curated lists:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception fetching curated lists:', error);
      return [];
    }
  }

  // Create a new list
  static async createList(fid: number, listName: string, description?: string, isPublic: boolean = false) {
    try {
      const { data, error } = await supabase
        .from('curated_lists')
        .insert([{
          fid,
          list_name: listName,
          description,
          is_public: isPublic
        }])
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          return { ok: false, error: 'List with this name already exists' };
        }
        console.error('Error creating list:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true, data };
    } catch (error: any) {
      console.error('Exception creating list:', error);
      return { ok: false, error: error?.message || 'Unknown error' };
    }
  }

  // Add cast to a list
  static async addCastToList(
    listId: number, 
    castHash: string, 
    addedByFid: number,
    castData?: { author_fid?: number; text?: string; timestamp?: string },
    notes?: string
  ) {
    try {
      const { data, error } = await supabase
        .from('curated_list_items')
        .insert([{
          list_id: listId,
          cast_hash: castHash,
          cast_author_fid: castData?.author_fid,
          cast_text: castData?.text,
          cast_timestamp: castData?.timestamp,
          added_by_fid: addedByFid,
          notes
        }])
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          return { ok: false, error: 'Cast already in this list' };
        }
        console.error('Error adding cast to list:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true, data };
    } catch (error: any) {
      console.error('Exception adding cast to list:', error);
      return { ok: false, error: error?.message || 'Unknown error' };
    }
  }

  // Get list by name for a user
  static async getListByName(fid: number, listName: string) {
    try {
      const { data, error } = await supabase
        .from('curated_lists')
        .select('*')
        .eq('fid', fid)
        .ilike('list_name', listName)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching list by name:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Exception fetching list by name:', error);
      return null;
    }
  }

  // Get list items
  static async getListItems(listId: number) {
    try {
      const { data, error } = await supabase
        .from('curated_list_items')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching list items:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception fetching list items:', error);
      return [];
    }
  }
}

export class BotConversationService {
  // Get active conversation for user
  static async getActiveConversation(userFid: number, conversationType?: string): Promise<BotConversation | null> {
    try {
      let query = supabase
        .from('bot_conversations')
        .select('*')
        .eq('user_fid', userFid)
        .gt('expires_at', new Date().toISOString());
      
      if (conversationType) {
        query = query.eq('conversation_type', conversationType);
      }
      
      const { data, error } = await query
        .order('last_interaction_at', { ascending: false })
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching conversation:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Exception fetching conversation:', error);
      return null;
    }
  }

  // Start a new conversation
  static async startConversation(
    userFid: number,
    conversationType: string,
    state: string,
    contextData?: any,
    parentCastHash?: string
  ) {
    try {
      const { data, error } = await supabase
        .from('bot_conversations')
        .insert([{
          user_fid: userFid,
          conversation_type: conversationType,
          state,
          context_data: contextData,
          parent_cast_hash: parentCastHash,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error starting conversation:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true, data };
    } catch (error: any) {
      console.error('Exception starting conversation:', error);
      return { ok: false, error: error?.message || 'Unknown error' };
    }
  }

  // Update conversation state
  static async updateConversation(
    conversationId: number,
    state: string,
    contextData?: any
  ) {
    try {
      const { data, error } = await supabase
        .from('bot_conversations')
        .update({
          state,
          context_data: contextData,
          last_interaction_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        })
        .eq('id', conversationId)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating conversation:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true, data };
    } catch (error: any) {
      console.error('Exception updating conversation:', error);
      return { ok: false, error: error?.message || 'Unknown error' };
    }
  }

  // End conversation
  static async endConversation(conversationId: number) {
    try {
      const { error } = await supabase
        .from('bot_conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) {
        console.error('Error ending conversation:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true };
    } catch (error: any) {
      console.error('Exception ending conversation:', error);
      return { ok: false, error: error?.message || 'Unknown error' };
    }
  }

  // Clean up expired conversations
  static async cleanupExpired() {
    try {
      const { error } = await supabase
        .from('bot_conversations')
        .delete()
        .lt('expires_at', new Date().toISOString());
      
      if (error) {
        console.error('Error cleaning up conversations:', error);
      }
    } catch (error) {
      console.error('Exception cleaning up conversations:', error);
    }
  }
}
