'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { learningQuestion, isLearningMode, type LearningMode } from '@/lib/conversation-learning';
import TypingDots from './TypingDots';
import MentionInput from './MentionInput';
import { chatHistoryKey, loadChatSnapshot, saveChatSnapshot } from '@/lib/ask-homie-history';
import { sanitizeAssistantResponse } from '@/lib/ai/sanitize-response';

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
    author: { username?: string; display_name?: string; fid?: number } | string;
    text: string;
    hash?: string;
    reactions?: { likes_count?: number; recasts_count?: number };
    replies?: { count?: number };
  };
  onCastSelect?: (cast: string) => void;
  initialMessage?: string;
  initialLearningMode?: LearningMode;
  contextReady?: boolean;
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
          className="text-zinc-400 hover:text-white hover:underline font-medium"
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
          className="text-zinc-400 hover:text-white hover:underline font-medium"
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

// Helper to get signerUuid from localStorage
function getSignerUuid(): string | null {
  try {
    const storedProfile = localStorage.getItem('hh_profile');
    if (!storedProfile) return null;
    const profile = JSON.parse(storedProfile);
    const fid = profile?.fid;
    if (!fid) return null;
    const signerData = localStorage.getItem(`signer_${fid}`);
    if (!signerData) return null;
    const parsed = JSON.parse(signerData);
    return parsed.signer_uuid || null;
  } catch {
    return null;
  }
}

export default function AgentChat({ userId, userContext, castContext, onCastSelect, initialMessage, initialLearningMode, contextReady = true }: AgentChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialMessage || '');
  const [isLoading, setIsLoading] = useState(false);
  const typingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isLoading) typingRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [isLoading]);
  const [learningMode, setLearningMode] = useState<LearningMode | undefined>(initialLearningMode);
  const [topic, setTopic] = useState('');
  const autoStarted = useRef<string | null>(null);
  const sending = useRef(false);
  const [mode, setMode] = useState<AgentMode>('auto');
  const [includeXForNextTurn, setIncludeXForNextTurn] = useState(false);
  const [userStats, setUserStats] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  const contextId = castContext?.hash || (castContext ? JSON.stringify([castContext.author, castContext.text]) : undefined);
  const historyKey = chatHistoryKey(userId, contextId);
  const [loadedHistoryKey, setLoadedHistoryKey] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadChatSnapshot(historyKey);
    if (saved) {
      setMessages(saved.messages.map(message => message.role === 'assistant'
        ? { ...message, content: sanitizeAssistantResponse(message.content) } : message) as Message[]);
      setInput(saved.input || '');
      setMode((['auto', 'compose', 'analyze', 'learn', 'research'].includes(saved.mode) ? saved.mode : 'auto') as AgentMode);
    } else {
      const author = typeof castContext?.author === 'string' ? castContext.author : castContext?.author?.username || 'someone';
      const preview = (castContext?.text || '').slice(0, 140);
      setMessages(castContext ? [{ role: 'assistant', content: `I see you have a cast from @${author}:\n\n"${preview}"\n\nWhat would you like to know about it?` }] : []);
      setInput(initialMessage || '');
      setMode('auto');
    }
    const lastLearning = saved?.messages.slice().reverse().find(message => message.role === 'user') as Message | undefined;
    setLearningMode(lastLearning ? (isLearningMode(lastLearning.metadata?.learningMode) ? lastLearning.metadata.learningMode : undefined) : initialLearningMode);
    setTopic(lastLearning?.metadata?.learningTopic || '');
    setLoadedHistoryKey(historyKey);
    // historyKey identifies both the account and cast context. Repeated context
    // object creation must not reset the restored conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyKey]);

  useEffect(() => {
    if (initialMessage) setInput(initialMessage);
  }, [initialMessage]);

  const saveConversation = () => {
    if (loadedHistoryKey === historyKey) {
      saveChatSnapshot(historyKey, { messages: messages.slice(-100), input, mode, timestamp: Date.now() });
    }
  };

  useEffect(() => {
    saveConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, input, mode, historyKey, loadedHistoryKey]);

  const shareCast = (text: string) => {
    saveConversation();
    const returnTo = window.location.pathname === '/ask-homie'
      ? window.location.pathname + window.location.search : '/ask-homie';
    router.push(`/compose?text=${encodeURIComponent(text)}&returnTo=${encodeURIComponent(returnTo)}`);
  };

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
      if (!res.ok) throw new Error(`Profile load failed: ${res.status}`);
      const data = await res.json();
      setUserProfile(data?.profile || null);
      setUserStats(data?.stats || null);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleSend = async (question = input, requestedLearningMode = learningMode) => {
    if (!question.trim() || sending.current || !contextReady || loadedHistoryKey !== historyKey) return;
    sending.current = true;
    setLearningMode(requestedLearningMode);
    const userMessage = question.trim();
    const xResearchRequested = includeXForNextTurn && !requestedLearningMode && mode !== 'compose';
    setIncludeXForNextTurn(false);
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, metadata: { learningMode: requestedLearningMode, learningTopic: topic, xResearchRequested } }]);
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
          learningMode: requestedLearningMode,
          learningTopic: requestedLearningMode ? topic : undefined,
          xResearchRequested,
          intent: mode === 'auto' ? undefined : mode
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || `Ask Homie request failed (${response.status}). Please try again.`);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: sanitizeAssistantResponse(data.response) || 'No response received.',
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
        content: error instanceof Error
          ? `I couldn't complete that request: ${error.message}`
          : 'I couldn’t complete that request. Please try again.'
      }]);
      setInput(userMessage);
    } finally {
      sending.current = false;
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!contextReady || loadedHistoryKey !== historyKey || initialLearningMode !== 'explain') return;
    if (autoStarted.current === historyKey) return;
    autoStarted.current = historyKey;
    // Returning from Share or refreshing a saved conversation must not spend
    // another request or replace the learner's draft.
    if (!messages.some(message => message.role === 'user')) {
      void handleSend(learningQuestion('explain'), 'explain');
    }
    // Run once after this account/context's history has been restored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextReady, loadedHistoryKey, historyKey, initialLearningMode]);

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
      <section aria-label="Learn with Ask Homie" className="border-b border-zinc-700 p-4">
        <h2 className="font-semibold">What would you like to understand?</h2>
        <p className="text-sm text-zinc-400 mt-1">Pick an idea from the conversation, or ask about any topic.</p>
        <label className="block text-sm mt-3" htmlFor="learning-topic">Topic or question (optional)</label>
        <input id="learning-topic" value={topic} maxLength={200} onChange={event => setTopic(event.target.value)}
          placeholder="For example: how end-to-end encryption works"
          className="w-full min-w-0 mt-1 p-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white" />
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn" disabled={isLoading || !contextReady} onClick={() => void handleSend(learningQuestion('explain', topic), 'explain')}>Explain in plain English</button>
          <button className="btn primary" disabled={isLoading || !contextReady} onClick={() => void handleSend(learningQuestion('lesson', topic), 'lesson')}>Build me a lesson</button>
        </div>
        {learningMode && <p className="text-xs text-zinc-400 mt-2">{learningMode === 'lesson' ? 'Lesson' : 'Plain-English'} mode · Ask follow-up questions below.</p>}
      </section>
      {/* Header with mode selector */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Ask Homie</h2>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  localStorage.removeItem('hh_chat_history');
                }}
                className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-300 dark:hover:text-zinc-200"
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
              onClick={() => { setMode(m); setLearningMode(undefined); setIncludeXForNextTurn(false); }}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                mode === m
                  ? 'bg-zinc-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
              title={modeDescriptions[m]}
            >
              {m}
            </button>
          ))}
        </div>

        {!learningMode && mode !== 'compose' && (
          <label className="mt-3 inline-flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={includeXForNextTurn}
              onChange={(event) => setIncludeXForNextTurn(event.target.checked)}
              className="mt-0.5 rounded"
            />
            <span>Include recent X posts on my next question (Pro only; up to 5 paid post reads, currently about $0.025 max).</span>
          </label>
        )}

        {/* User stats */}
        {userStats && (
          <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400 flex gap-4">
            <span>📝 {userStats.totalCasts} casts tracked</span>
            <span>💬 {userStats.totalFeedback} feedback items</span>
            {userStats.patterns?.length > 0 && (
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
            <p className="text-lg font-medium mb-2">Hey! What are you curious about?</p>
            <p className="text-sm">I can help you:</p>
            <ul className="text-sm mt-2 space-y-1">
              <li>✍️ Write better casts</li>
              <li>🔍 Analyze your content</li>
              <li>💡 Turn conversations into lessons</li>
              <li>📚 Understand AI, privacy, crypto, and more</li>
            </ul>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`hh-chat-message flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-800 text-zinc-100'
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
                      <a {...props} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white hover:underline" />
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
                  {sanitizeAssistantResponse(msg.content)}
                </ReactMarkdown>
              ) : (
                <div className="whitespace-pre-wrap">
                  {parseTextWithMentions(msg.content)}
                </div>
              )}

              {msg.role === 'assistant' && msg.metadata?.liveCastSearch && (
                <div className="mt-3 border-t border-zinc-700 pt-2 text-xs text-zinc-400">
                  <p>{msg.metadata.liveCastSearch.resultCount > 0
                    ? `Related casts · ${msg.metadata.liveCastSearch.resultCount} retrieved from Hypersnap`
                    : 'Hypersnap search found no matches or was unavailable. This does not disprove the topic.'}</p>
                  <p>Posts reflect their authors’ claims and may need corroboration.</p>
                  {msg.metadata.liveCastSearch.citations?.map((cast: { url: string; username: string; text: string; timestamp?: string | number }) => (
                    <Link key={cast.url} href={cast.url} className="mt-2 block text-indigo-300 hover:underline">
                      @{cast.username}: {cast.text}
                    </Link>
                  ))}
                </div>
              )}

              {msg.role === 'assistant' && msg.metadata?.liveWebSearch && (
                <div className="mt-3 border-t border-zinc-700 pt-2 text-xs text-zinc-400">
                  <div>
                    Live web search {msg.metadata.liveWebSearch.status === 'searched' ? 'sources' : 'unavailable'}
                  </div>
                  {msg.metadata.liveWebSearch.citations?.map((url: string, sourceIndex: number) => (
                    <a
                      key={`${url}-${sourceIndex}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-indigo-300 hover:underline"
                    >
                      {url.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0]}
                    </a>
                  ))}
                </div>
              )}

              {msg.role === 'assistant' && msg.metadata?.liveXSearch && (
                <div className="mt-3 border-t border-zinc-700 pt-2 text-xs text-zinc-400">
                  <p>
                    {msg.metadata.liveXSearch.status === 'pro-required'
                      ? 'X search is available with Homiehouse Pro.'
                      : msg.metadata.liveXSearch.status === 'searched'
                        ? `Recent X posts · ${msg.metadata.liveXSearch.resultCount} found`
                        : msg.metadata.liveXSearch.status === 'no-results'
                          ? 'X search found no recent matches. This does not disprove the topic.'
                          : msg.metadata.liveXSearch.status === 'budget-exhausted'
                            ? 'The monthly X search read limit has been reached.'
                          : 'X search is unavailable or not configured.'}
                  </p>
                  <p>Posts reflect their authors’ claims; open the originals to review context.</p>
                  {msg.metadata.liveXSearch.citations?.map((post: { url: string; username: string }) => (
                    <a
                      key={post.url}
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-indigo-300 hover:underline"
                    >
                      View post by @{post.username} on X ↗
                    </a>
                  ))}
                </div>
              )}

              {/* Share button for assistant messages */}
              {msg.role === 'assistant' && (
                <div className="mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700 flex gap-2">
                  <button
                    onClick={() => {
                      const attribution = '\n\nshared from @auntiehomie';
                      const finalText = sanitizeAssistantResponse(msg.content) + attribution;
                      shareCast(finalText);
                    }}
                    className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors flex items-center gap-1"
                    title="Share as cast"
                  >
                    <span aria-hidden="true">📤</span>
                    <span>Share as Cast</span>
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sanitizeAssistantResponse(msg.content));
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
                            className="text-xs px-2 py-1 bg-white text-black rounded hover:bg-zinc-200"
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

              {msg.role === 'assistant' && msg.metadata?.learningMode && (
                <div className="mt-3 text-xs text-zinc-400 space-y-1">
                  <p>Background sources · not a live web check</p>
                  {msg.metadata.sources?.length ? msg.metadata.sources.map((source: { title: string; url: string }) => (
                    /^https:\/\//i.test(source.url) ? <a key={source.url} className="block underline break-words" href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> : null
                  )) : <p>No supporting sources retrieved. Ask Homie may make mistakes.</p>}
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

        {(isLoading || !contextReady) && (
          <div ref={typingRef} className="hh-chat-message flex justify-start">
            <TypingDots label={contextReady ? 'Ask Homie is thinking' : 'Loading conversation'} />
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
              className="w-full px-4 py-3 text-base rounded-lg border border-zinc-700 bg-zinc-900 text-white focus:outline-none focus:border-zinc-500 disabled:opacity-50"
              onUserSelect={(user) => {
                console.log('User mentioned:', user);
              }}
            />
          </div>
          <button
            onClick={() => void handleSend()}
            disabled={isLoading || !input.trim() || !contextReady}
            className="px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(180deg, #334155 0%, #1e293b 100%)', color: '#e2e8f0', border: '1px solid #475569' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
