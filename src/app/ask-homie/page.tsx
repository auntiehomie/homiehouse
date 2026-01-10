'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { useSearchParams } from 'next/navigation';

export default function AskHomiePage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [castContext, setCastContext] = useState<any>(null);
  const searchParams = useSearchParams();

  // Load cast context from URL or localStorage
  useEffect(() => {
    const castData = searchParams.get('cast');
    if (castData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(castData));
        setCastContext(decoded);
        localStorage.setItem('hh_ask_context', castData);
      } catch (e) {
        console.error('Failed to parse cast data', e);
      }
    } else {
      const stored = localStorage.getItem('hh_ask_context');
      if (stored) {
        try {
          setCastContext(JSON.parse(decodeURIComponent(stored)));
        } catch (e) {}
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userMessage = question;
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ask-homie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, { role: 'user', content: userMessage }],
          castContext 
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response 
      }]);
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

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-black text-black dark:text-white">
      <main className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold mb-2">Ask Homie</h1>
        <p className="mb-6 text-zinc-600 dark:text-zinc-400">Your AI assistant for HomieHouse</p>

        {castContext && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="font-medium text-sm text-blue-900 dark:text-blue-100">📌 Asking about this cast:</div>
              <button
                onClick={() => {
                  setCastContext(null);
                  localStorage.removeItem('hh_ask_context');
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear context
              </button>
            </div>
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              <div className="font-medium">@{castContext.author}</div>
              <div className="mt-1">{castContext.text?.substring(0, 150)}{castContext.text?.length > 150 ? '...' : ''}</div>
            </div>
          </div>
        )}

        <div className="mb-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 min-h-[400px] max-h-[500px] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center text-zinc-500 mt-20">
              <p className="text-lg mb-2">👋 Hey there!</p>
              <p>Ask me anything about HomieHouse, Farcaster, or crypto.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block px-4 py-2 rounded-lg ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="text-left">
                  <div className="inline-block px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask Homie a question..."
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>

        <div style={{ marginTop: 16 }}>
          <Link href="/">← Back to Home</Link>
        </div>
      </main>
    </div>
  );
}
