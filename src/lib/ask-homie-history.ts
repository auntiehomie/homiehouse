'use client';

export interface ChatSnapshot {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  input: string;
  mode: string;
  timestamp: number;
}

const memory = new Map<string, ChatSnapshot>();
const MAX_AGE = 24 * 60 * 60 * 1000;
export const chatHistoryKey = (userId?: string, context?: string): string =>
  `hh_chat_v2:${JSON.stringify([userId || 'guest', context || 'general'])}`;

export function saveChatSnapshot(key: string, snapshot: ChatSnapshot): void {
  if (typeof window === 'undefined') return;
  memory.set(key, snapshot);
  if (memory.size > 20) memory.delete(memory.keys().next().value!);
  try { localStorage.setItem(key, JSON.stringify(snapshot)); } catch { /* tab memory still works */ }
}

export function loadChatSnapshot(key: string): ChatSnapshot | null {
  if (typeof window === 'undefined') return null;
  let snapshot = memory.get(key);
  if (!snapshot) {
    try { snapshot = JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }
  if (!snapshot || !Array.isArray(snapshot.messages) || !snapshot.timestamp || Date.now() - snapshot.timestamp > MAX_AGE) return null;
  return snapshot;
}
