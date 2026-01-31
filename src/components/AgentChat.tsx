'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MentionInput from './MentionInput';
import { sdk } from '@farcaster/miniapp-sdk';

type AgentMode = 'compose' | 'analyze' | 'learn' | 'research' | 'auto';
type AgentRole = 'composer' | 'analyzer' | 'coach' | 'researcher';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  agentRole?: AgentRole;
  metadata?: any;
}

interface AgentChatProps {
  userId?: string;
  userContext?: {
    username?: string;
    fid?: number;
    displayName?: string;
  };
  castContext?: {
    author: string;
    text: string;
  };
  onCastSelect?: (cast: string) => void;
}

// Helper function to parse text and make @mentions and FIDs clickable
function parseTextWithMentions(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Match @mentions and FID: patterns
  const regex = /@([a-zA-Z0-9_-]+)|FID:\s*(\d+)|fid:\s*(\d+)/gi;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    
    if (match[1]) {
      // It's an @mention
      const username = match[1];
      parts.push(
        <Link
          key={match.index}
          href={`/profile?user=${username}`}
          className="text-blue-500 hover:text-blue-600 hover:underline font-medium"
        >
          @{username}
        </Link>
      );
    } else if (match[2] || match[3]) {
      // It's a FID
      const fid = match[2] || match[3];
      parts.push(
        <Link
          key={match.index}
          href={`https://warpcast.com/~/profiles/${fid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600 hover:underline font-medium"
        >
          FID: {fid}
        </Link>
      );
    }
    
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

export default function AgentChat({ userId, userContext, castContext, onCastSelect }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AgentMode>('auto');
  const [userStats, setUserStats] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Load conversation history from localStorage on mount
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem('hh_chat_history');
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        // Only load if it's relatively recent (last 24 hours)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setMessages(parsed.messages || []);
        } else {
          // Clear old history
          localStorage.removeItem('hh_chat_history');
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, []);

  // Save conversation history to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem('hh_chat_history', JSON.stringify({
          messages,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Failed to save chat history:', error);
      }
    }
  }, [messages]);

  const agentIcons: Record<AgentRole, string> = {
    composer: '✍️',
    analyzer: '🔍',
    coach: '💡',
    researcher: '📚'
  };

  const modeDescriptions: Record<AgentMode, string> = {
    compose: 'Help me write a cast',
    analyze: 'Review my cast',
    learn: 'Give me improvement tips',
    research: 'Explain something',
    auto: 'Auto-detect what I need'
  };

  // Load user profile
  useEffect(() => {
    if (userId) {
      loadUserProfile();
    }
  }, [userId]);

  const loadUserProfile = async () => {
    try {
      const res = await fetch(`/api/ask-homie?userId=${userId}`);
      const data = await res.json();
      setUserProfile(data.profile);
      setUserStats(data.stats);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ask-homie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          castContext,
          mode: 'agent',
          userId: userId || `temp_${Date.now()}`,
          userContext,
          intent: mode === 'auto' ? undefined : mode
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        suggestions: data.suggestions,
        agentRole: data.agentRole,
        metadata: data.metadata
      }]);

      if (data.userStats) {
        setUserStats(data.userStats);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (cast: string, wasHelpful: boolean) => {
    try {
      await fetch('/api/ask-homie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          mode: 'agent',
          userId: userId || `temp_${Date.now()}`,
          feedback: {
            cast,
            feedback: wasHelpful ? 'helpful' : 'not helpful'
          }
        })
      });
      // Reload stats
      if (userId) {
        loadUserProfile();
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const updateProfile = async (updates: any) => {
    try {
      const res = await fetch('/api/ask-homie', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || `temp_${Date.now()}`,
          updates
        })
      });
      const data = await res.json();
      setUserProfile(data.profile);
      setUserStats(data.stats);
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with mode selector */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Ask Homie AI</h2>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  localStorage.removeItem('hh_chat_history');
                }}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                title="Clear conversation history"
              >
                🗑️ Clear
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white"
            >
              ⚙️ Settings
            </button>
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(modeDescriptions) as AgentMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                mode === m
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              title={modeDescriptions[m]}
            >
              {m}
            </button>
          ))}
        </div>

        {/* User stats */}
        {userStats && (
          <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400 flex gap-4">
            <span>📝 {userStats.totalCasts} casts tracked</span>
            <span>💬 {userStats.totalFeedback} feedback items</span>
            {userStats.patterns.length > 0 && (
              <span>🎯 {userStats.patterns.length} patterns identified</span>
            )}
          </div>
        )}

        {/* Settings panel */}
        {showSettings && userProfile && (
          <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg space-y-3">
            <h3 className="font-medium text-sm mb-2">Preferences</h3>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                  Writing Style
                </label>
                <select
                  value={userProfile.writingStyle}
                  onChange={(e) => updateProfile({ writingStyle: e.target.value })}
                  className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                >
                  <option value="casual">Casual</option>
                  <option value="professional">Professional</option>
                  <option value="technical">Technical</option>
                  <option value="creative">Creative</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                  Tone
                </label>
                <select
                  value={userProfile.preferredTone}
                  onChange={(e) => updateProfile({ preferredTone: e.target.value })}
                  className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                >
                  <option value="friendly">Friendly</option>
                  <option value="informative">Informative</option>
                  <option value="humorous">Humorous</option>
                  <option value="serious">Serious</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                  Cast Length
                </label>
                <select
                  value={userProfile.castLength}
                  onChange={(e) => updateProfile({ castLength: e.target.value })}
                  className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userProfile.useEmojis}
                    onChange={(e) => updateProfile({ useEmojis: e.target.checked })}
                    className="rounded"
                  />
                  <span>Use Emojis</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userProfile.useHashtags}
                    onChange={(e) => updateProfile({ useHashtags: e.target.checked })}
                    className="rounded"
                  />
                  <span>Use Hashtags</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 dark:text-zinc-400 mt-8">
            <div className="text-4xl mb-4">🏠</div>
            <p className="text-lg font-medium mb-2">Hey! I'm your Farcaster AI assistant</p>
            <p className="text-sm">I can help you:</p>
            <ul className="text-sm mt-2 space-y-1">
              <li>✍️ Write better casts</li>
              <li>🔍 Analyze your content</li>
              <li>💡 Learn from your patterns</li>
              <li>📚 Research Farcaster topics</li>
            </ul>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {msg.role === 'assistant' && msg.agentRole && (
                <div className="text-xs opacity-70 mb-1">
                  {agentIcons[msg.agentRole]} {msg.agentRole}
                </div>
              )}
              
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline" />
                    ),
                    code: ({ node, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return match ? (
                        <code className={`${className} block bg-zinc-800 text-zinc-100 p-2 rounded my-2 overflow-x-auto`} {...props}>
                          {children}
                        </code>
                      ) : (
                        <code className="bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded text-sm" {...props}>
                          {children}
                        </code>
                      );
                    },
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-3 mb-2" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-2 mb-1" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc list-inside my-2 space-y-1" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside my-2 space-y-1" {...props} />,
                    p: ({ node, ...props }) => <p className="my-2" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                    em: ({ node, ...props }) => <em className="italic" {...props} />,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                <div className="whitespace-pre-wrap">
                  {parseTextWithMentions(msg.content)}
                </div>
              )}

              {/* Share button for assistant messages */}
              {msg.role === 'assistant' && (
                <div className="mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700 flex gap-2">
                  <button
                    onClick={async () => {
                      // Use proper Farcaster mention format with FID for @homiehouse
                      const attribution = '\n\nshared from @homiehouse';
                      const embedUrl = 'https://homiehouse.fun';
                      const finalText = msg.content + attribution;
                      
                      try {
                        // Try to use Farcaster SDK for mini apps with embed
                        await sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(finalText)}&embeds[]=${encodeURIComponent(embedUrl)}`);
                      } catch (error) {
                        // Fallback to window.open for non-mini-app contexts
                        window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(finalText)}&embeds[]=${encodeURIComponent(embedUrl)}`, '_blank');
                      }
                    }}
                    className="text-xs px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-1"
                    title="Share as cast"
                  >
                    <span>📤</span>
                    <span>Share as Cast</span>
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content);
                      alert('Copied to clipboard!');
                    }}
                    className="text-xs px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    📋 Copy
                  </button>
                </div>
              )}

              {/* Show suggestions */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-medium opacity-70">Suggested casts:</div>
                  {msg.suggestions.map((suggestion, i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-zinc-900 p-2 rounded text-sm border border-zinc-200 dark:border-zinc-700"
                    >
                      <div className="mb-2">{suggestion}</div>
                      <div className="flex gap-2">
                        {onCastSelect && (
                          <button
                            onClick={() => onCastSelect(suggestion)}
                            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Use this
                          </button>
                        )}
                        <button
                          onClick={() => navigator.clipboard.writeText(suggestion)}
                          className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => handleFeedback(suggestion, true)}
                          className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        >
                          👍
                        </button>
                        <button
                          onClick={() => handleFeedback(suggestion, false)}
                          className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        >
                          👎
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Show tips */}
              {msg.metadata?.tips && msg.metadata.tips.length > 0 && (
                <div className="mt-2 text-xs opacity-75 space-y-1">
                  {msg.metadata.tips.map((tip: string, i: number) => (
                    <div key={i}>💡 {tip}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 overflow-visible">
        <div className="flex gap-3 relative items-end">
          <div className="flex-1">
            <MentionInput
              value={input}
              onChange={setInput}
              placeholder={`${modeDescriptions[mode]}...`}
              className="w-full px-4 py-3 text-base rounded-lg border-2 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              onUserSelect={(user) => {
                console.log('User mentioned:', user);
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors whitespace-nowrap"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
