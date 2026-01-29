'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import AgentChat from '@/components/AgentChat';

export default function AskHomieMiniApp() {
  const [isReady, setIsReady] = useState(false);
  const [context, setContext] = useState<any>(null);

  useEffect(() => {
    async function init() {
      try {
        // Get Farcaster context
        const ctx = await sdk.context;
        setContext(ctx);
        
        // Signal app is ready
        await sdk.actions.ready();
        setIsReady(true);
        
        console.log('Mini app ready with context:', ctx);
      } catch (error) {
        console.error('Mini app initialization error:', error);
        // Still mark as ready even if context fails
        await sdk.actions.ready();
        setIsReady(true);
      }
    }

    init();
  }, []);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Ask Homie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">🏡 Ask Homie</h1>
          <p className="text-sm text-gray-600 mt-1">
            Your AI assistant for Farcaster
          </p>
          {context?.user && (
            <p className="text-xs text-gray-500 mt-2">
              Connected as @{context.user.username} (FID: {context.user.fid})
            </p>
          )}
        </div>

        {/* Chat Interface */}
        <div className="bg-white rounded-lg shadow-sm">
          <AgentChat 
            userId={context?.user?.fid?.toString()}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-500">
          <p>Built on Farcaster Mini Apps</p>
          <p className="mt-1">
            <a 
              href="https://homiehouse.xyz" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-600 hover:underline"
            >
              Visit HomieHouse
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
