'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import AgentChat from '@/components/AgentChat';

interface UserStats {
  followerCount: number;
  followingCount: number;
  username: string;
  displayName: string;
  pfpUrl: string;
}

export default function AskHomieMiniApp() {
  const [isReady, setIsReady] = useState(false);
  const [context, setContext] = useState<any>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

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

        // Fetch user stats
        if (ctx?.user?.fid) {
          fetchUserStats(ctx.user.fid);
        }
      } catch (error) {
        console.error('Mini app initialization error:', error);
        // Still mark as ready even if context fails
        await sdk.actions.ready();
        setIsReady(true);
      }
    }

    init();
  }, []);

  const fetchUserStats = async (fid: number) => {
    setLoadingStats(true);
    try {
      const response = await fetch(`/api/miniapp/stats?fid=${fid}`);
      
      if (response.ok) {
        const data = await response.json();
        setUserStats(data);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-200">Loading Ask Homie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header with Profile Stats */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg p-4 mb-4 border border-purple-500/20">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                🏡 Ask Homie
              </h1>
              <p className="text-sm text-gray-300 mt-1">
                Your AI assistant for Farcaster
              </p>
            </div>
            {userStats && (
              <div className="flex items-center gap-3">
                {userStats.pfpUrl && (
                  <img 
                    src={userStats.pfpUrl} 
                    alt={userStats.displayName}
                    className="w-10 h-10 rounded-full border-2 border-purple-400"
                  />
                )}
              </div>
            )}
          </div>

          {/* User Stats */}
          {context?.user && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="text-gray-400">Connected as</p>
                  <p className="text-white font-medium">
                    @{context.user.username}
                  </p>
                </div>
                {loadingStats ? (
                  <div className="animate-pulse flex gap-4">
                    <div className="h-8 w-20 bg-gray-700 rounded"></div>
                    <div className="h-8 w-20 bg-gray-700 rounded"></div>
                  </div>
                ) : userStats ? (
                  <div className="flex gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-400">
                        {userStats.followerCount.toLocaleString()}
                      </p>
                      <p className="text-gray-400">Followers</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-400">
                        {userStats.followingCount.toLocaleString()}
                      </p>
                      <p className="text-gray-400">Following</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Chat Interface */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-purple-500/20 overflow-hidden">
          <AgentChat 
            userId={context?.user?.fid?.toString()}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-400">
          <p>Built on Farcaster Mini Apps</p>
          <p className="mt-1">
            <a 
              href="https://homiehouse.xyz" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Visit HomieHouse
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
