import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export interface CurationPreference {
  id?: number;
  fid: number;
  preference_type: 'keyword' | 'channel' | 'author' | 'content_type' | 'min_likes' | 'max_length';
  preference_value: string;
  action: 'include' | 'exclude';
  priority?: number;
  created_at?: string;
  updated_at?: string;
}

export class CurationService {
  // Get all curation preferences for a user
  static async getPreferences(fid: number): Promise<CurationPreference[]> {
    try {
      const { data, error } = await supabase
        .from('user_curation_preferences')
        .select('*')
        .eq('fid', fid)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching curation preferences:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception fetching curation preferences:', error);
      return [];
    }
  }

  // Get preferences by type
  static async getPreferencesByType(fid: number, type: string): Promise<CurationPreference[]> {
    try {
      const { data, error } = await supabase
        .from('user_curation_preferences')
        .select('*')
        .eq('fid', fid)
        .eq('preference_type', type)
        .order('priority', { ascending: false });
      
      if (error) {
        console.error('Error fetching preferences by type:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception fetching preferences by type:', error);
      return [];
    }
  }

  // Add a new curation preference
  static async addPreference(preference: CurationPreference): Promise<{ ok: boolean; data?: any; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('user_curation_preferences')
        .insert([{
          fid: preference.fid,
          preference_type: preference.preference_type,
          preference_value: preference.preference_value,
          action: preference.action,
          priority: preference.priority || 0
        }])
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') {
          return { ok: false, error: 'Preference already exists' };
        }
        console.error('Error adding curation preference:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true, data };
    } catch (error: any) {
      console.error('Exception adding curation preference:', error);
      return { ok: false, error: error?.message || 'Unknown error' };
    }
  }

  // Update a curation preference
  static async updatePreference(id: number, updates: Partial<CurationPreference>): Promise<{ ok: boolean; error?: string }> {
    try {
      const updateData: any = { ...updates, updated_at: new Date().toISOString() };
      delete updateData.id;
      delete updateData.fid;
      delete updateData.created_at;
      
      const { error } = await supabase
        .from('user_curation_preferences')
        .update(updateData)
        .eq('id', id);
      
      if (error) {
        console.error('Error updating curation preference:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true };
    } catch (error: any) {
      console.error('Exception updating curation preference:', error);
      return { ok: false, error: error?.message || 'Unknown error' };
    }
  }

  // Delete a curation preference
  static async deletePreference(id: number): Promise<{ ok: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('user_curation_preferences')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting curation preference:', error);
        return { ok: false, error: error.message };
      }
      
      return { ok: true };
    } catch (error: any) {
      console.error('Exception deleting curation preference:', error);
      return { ok: false, error: error?.message || 'Unknown error' };
    }
  }

  // Apply curation filters to feed items
  static applyCurationFilters(items: any[], preferences: CurationPreference[]): any[] {
    if (!preferences || preferences.length === 0) {
      return items;
    }

    // Separate include and exclude preferences
    const includePrefs = preferences.filter(p => p.action === 'include');
    const excludePrefs = preferences.filter(p => p.action === 'exclude');

    let filtered = [...items];

    // Apply exclude filters first (remove unwanted content)
    for (const pref of excludePrefs) {
      filtered = filtered.filter(item => {
        return !this.matchesPreference(item, pref);
      });
    }

    // If there are include filters, boost matching items
    if (includePrefs.length > 0) {
      filtered = filtered.map(item => {
        let boostScore = 0;
        for (const pref of includePrefs) {
          if (this.matchesPreference(item, pref)) {
            boostScore += (pref.priority || 0) + 1;
          }
        }
        return { ...item, _curationScore: boostScore };
      });

      // Sort by curation score (higher first)
      filtered.sort((a, b) => (b._curationScore || 0) - (a._curationScore || 0));
    }

    return filtered;
  }

  // Check if an item matches a preference
  private static matchesPreference(item: any, pref: CurationPreference): boolean {
    const value = pref.preference_value.toLowerCase();

    switch (pref.preference_type) {
      case 'keyword':
        const text = (item.text || '').toLowerCase();
        return text.includes(value);

      case 'channel':
        const channel = (item.channel?.id || item.channel?.name || '').toLowerCase();
        return channel === value;

      case 'author':
        const authorFid = String(item.author?.fid || '');
        const authorUsername = (item.author?.username || '').toLowerCase();
        return authorFid === value || authorUsername === value;

      case 'content_type':
        if (value === 'has_image') {
          return item.embeds && item.embeds.some((e: any) => e.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(e.url));
        }
        if (value === 'has_video') {
          return item.embeds && item.embeds.some((e: any) => e.url && /\.(mp4|mov|webm)$/i.test(e.url));
        }
        if (value === 'has_link') {
          return item.embeds && item.embeds.some((e: any) => e.url);
        }
        if (value === 'text_only') {
          return !item.embeds || item.embeds.length === 0;
        }
        return false;

      case 'min_likes':
        const minLikes = parseInt(value);
        return (item.reactions?.likes_count || 0) >= minLikes;

      case 'max_length':
        const maxLength = parseInt(value);
        return (item.text || '').length <= maxLength;

      default:
        return false;
    }
  }
}
