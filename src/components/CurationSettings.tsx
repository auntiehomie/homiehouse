"use client";

import React, { useState, useEffect } from "react";

interface CurationPreference {
  id?: number;
  fid: number;
  preference_type: 'keyword' | 'channel' | 'author' | 'content_type' | 'min_likes' | 'max_length';
  preference_value: string;
  action: 'include' | 'exclude';
  priority?: number;
}

interface CurationSettingsProps {
  onClose: () => void;
}

export default function CurationSettings({ onClose }: CurationSettingsProps) {
  const [preferences, setPreferences] = useState<CurationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [preferenceType, setPreferenceType] = useState<CurationPreference['preference_type']>('keyword');
  const [preferenceValue, setPreferenceValue] = useState('');
  const [action, setAction] = useState<'include' | 'exclude'>('include');
  const [priority, setPriority] = useState(0);

  // Get user's FID from localStorage
  const getFid = (): number | null => {
    const storedProfile = localStorage.getItem("hh_profile");
    if (!storedProfile) return null;
    try {
      const profile = JSON.parse(storedProfile);
      return profile?.fid || null;
    } catch {
      return null;
    }
  };

  const fid = getFid();

  // Load preferences
  useEffect(() => {
    if (!fid) {
      setLoading(false);
      return;
    }
    
    loadPreferences();
  }, [fid]);

  const loadPreferences = async () => {
    if (!fid) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/curation?fid=${fid}`);
      const data = await res.json();
      
      if (data.ok) {
        setPreferences(data.preferences || []);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!fid || !preferenceValue.trim()) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/curation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid,
          preference_type: preferenceType,
          preference_value: preferenceValue.trim(),
          action,
          priority
        })
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setPreferenceValue('');
        setPriority(0);
        await loadPreferences();
      } else {
        alert(data.error || 'Failed to add preference');
      }
    } catch (error) {
      console.error('Error adding preference:', error);
      alert('Failed to add preference');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this preference?')) return;
    
    try {
      const res = await fetch(`/api/curation?id=${id}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (data.ok) {
        await loadPreferences();
      } else {
        alert(data.error || 'Failed to delete preference');
      }
    } catch (error) {
      console.error('Error deleting preference:', error);
      alert('Failed to delete preference');
    }
  };

  const getPreferenceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      keyword: 'Keyword',
      channel: 'Channel',
      author: 'Author',
      content_type: 'Content Type',
      min_likes: 'Minimum Likes',
      max_length: 'Max Length'
    };
    return labels[type] || type;
  };

  const getContentTypeLabel = (value: string) => {
    const labels: Record<string, string> = {
      has_image: 'Has Image',
      has_video: 'Has Video',
      has_link: 'Has Link',
      text_only: 'Text Only'
    };
    return labels[value] || value;
  };

  if (!fid) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-2xl w-full p-6">
          <p className="text-center">Please sign in to manage curation preferences</p>
          <button onClick={onClose} className="mt-4 btn primary w-full">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Curation Settings</h2>
          <button onClick={onClose} className="text-2xl hover:opacity-70">×</button>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Add New Preference</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Type</label>
              <select
                value={preferenceType}
                onChange={(e) => setPreferenceType(e.target.value as CurationPreference['preference_type'])}
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
              >
                <option value="keyword">Keyword</option>
                <option value="channel">Channel</option>
                <option value="author">Author</option>
                <option value="content_type">Content Type</option>
                <option value="min_likes">Minimum Likes</option>
                <option value="max_length">Max Length</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as 'include' | 'exclude')}
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
              >
                <option value="include">Include (Show More)</option>
                <option value="exclude">Exclude (Hide)</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Value
              {preferenceType === 'content_type' && (
                <span className="text-xs text-gray-500 ml-2">
                  (Options: has_image, has_video, has_link, text_only)
                </span>
              )}
            </label>
            {preferenceType === 'content_type' ? (
              <select
                value={preferenceValue}
                onChange={(e) => setPreferenceValue(e.target.value)}
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
              >
                <option value="">Select content type...</option>
                <option value="has_image">Has Image</option>
                <option value="has_video">Has Video</option>
                <option value="has_link">Has Link</option>
                <option value="text_only">Text Only</option>
              </select>
            ) : (
              <input
                type={preferenceType === 'min_likes' || preferenceType === 'max_length' ? 'number' : 'text'}
                value={preferenceValue}
                onChange={(e) => setPreferenceValue(e.target.value)}
                placeholder={
                  preferenceType === 'keyword' ? 'Enter keyword...' :
                  preferenceType === 'channel' ? 'Channel name...' :
                  preferenceType === 'author' ? 'FID or username...' :
                  preferenceType === 'min_likes' ? '10' :
                  '280'
                }
                className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
              />
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Priority (higher = more important)
            </label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              className="w-full p-2 border rounded dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={saving || !preferenceValue.trim()}
            className="btn primary w-full"
          >
            {saving ? 'Adding...' : 'Add Preference'}
          </button>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Current Preferences</h3>
          
          {loading ? (
            <p className="text-center py-8">Loading preferences...</p>
          ) : preferences.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              No curation preferences yet. Add some above to customize your feed!
            </p>
          ) : (
            <div className="space-y-3">
              {preferences.map((pref) => (
                <div
                  key={pref.id}
                  className="border dark:border-zinc-700 rounded-lg p-4 flex justify-between items-center"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        pref.action === 'include' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {pref.action === 'include' ? 'INCLUDE' : 'EXCLUDE'}
                      </span>
                      <span className="text-sm font-medium">
                        {getPreferenceTypeLabel(pref.preference_type)}
                      </span>
                      {pref.priority !== undefined && pref.priority > 0 && (
                        <span className="text-xs text-gray-500">
                          Priority: {pref.priority}
                        </span>
                      )}
                    </div>
                    <div className="text-lg">
                      {pref.preference_type === 'content_type' 
                        ? getContentTypeLabel(pref.preference_value)
                        : pref.preference_value}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(pref.id!)}
                    className="text-red-500 hover:text-red-700 px-3 py-1 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t dark:border-zinc-700">
          <h3 className="text-sm font-semibold mb-2">How Curation Works</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• <strong>Include</strong> preferences boost content matching your interests</li>
            <li>• <strong>Exclude</strong> preferences hide unwanted content</li>
            <li>• Higher priority preferences are applied first</li>
            <li>• Keywords search cast text; channels match channel names</li>
            <li>• Authors can be matched by FID or username</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
