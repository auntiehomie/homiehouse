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

interface CastAnalysis {
  cast: any;
  author: any;
  engagement: any;
  reputation: any;
}

interface UserAnalysis {
  profile: any;
  stats: any;
  reputation: any;
  activity: any;
}

interface TokenAnalysis {
  token: string;
  analysis: string;
  summary: {
    investmentRating: string;
    riskFactors: string[];
    lastUpdated: string;
  };
  disclaimer: string;
}

export default function AskHomieMiniApp() {
  const [isReady, setIsReady] = useState(false);
  const [context, setContext] = useState<any>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'analyze'>('chat');
  const [analyzeType, setAnalyzeType] = useState<'cast' | 'user' | 'token'>('cast');
  const [analyzeInput, setAnalyzeInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [castAnalysis, setCastAnalysis] = useState<CastAnalysis | null>(null);
  const [userAnalysis, setUserAnalysis] = useState<UserAnalysis | null>(null);
  const [tokenAnalysis, setTokenAnalysis] = useState<TokenAnalysis | null>(null);

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

  const analyzeCast = async () => {
    if (!analyzeInput.trim()) return;
    
    setAnalyzing(true);
    setCastAnalysis(null);
    try {
      const isUrl = analyzeInput.includes('warpcast.com') || analyzeInput.includes('0x');
      const param = isUrl ? `url=${encodeURIComponent(analyzeInput)}` : `hash=${analyzeInput}`;
      const response = await fetch(`/api/miniapp/analyze-cast?${param}`);
      
      if (response.ok) {
        const data = await response.json();
        setCastAnalysis(data);
      }
    } catch (error) {
      console.error('Error analyzing cast:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeUser = async () => {
    if (!analyzeInput.trim()) return;
    
    setAnalyzing(true);
    setUserAnalysis(null);
    try {
      const isNumber = /^\d+$/.test(analyzeInput);
      const param = isNumber ? `fid=${analyzeInput}` : `username=${analyzeInput}`;
      const response = await fetch(`/api/miniapp/analyze-user?${param}`);
      
      if (response.ok) {
        const data = await response.json();
        setUserAnalysis(data);
      }
    } catch (error) {
      console.error('Error analyzing user:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeToken = async () => {
    if (!analyzeInput.trim()) return;
    
    setAnalyzing(true);
    setTokenAnalysis(null);
    try {
      const response = await fetch('/api/miniapp/analyze-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: analyzeInput })
      });
      
      if (response.ok) {
        const data = await response.json();
        setTokenAnalysis(data);
      }
    } catch (error) {
      console.error('Error analyzing token:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyze = () => {
    if (analyzeType === 'cast') {
      analyzeCast();
    } else if (analyzeType === 'user') {
      analyzeUser();
    } else {
      analyzeToken();
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
      <div className="max-w-4xl mx-auto p-4 pb-20">
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

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'chat'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-gray-800/50 text-gray-300 hover:bg-gray-800'
            }`}
          >
            💬 Chat
          </button>
          <button
            onClick={() => setActiveTab('analyze')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'analyze'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-gray-800/50 text-gray-300 hover:bg-gray-800'
            }`}
          >
            🔍 Analyze
          </button>
        </div>

        {/* Content */}
        {activeTab === 'chat' ? (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-purple-500/20 overflow-hidden">
            <AgentChat 
              userId={context?.user?.fid?.toString()}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Analyze Input */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg p-4 border border-purple-500/20">
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => setAnalyzeType('cast')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    analyzeType === 'cast'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  📝 Cast
                </button>
                <button
                  onClick={() => setAnalyzeType('user')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    analyzeType === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  👤 User
                </button>
                <button
                  onClick={() => setAnalyzeType('token')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    analyzeType === 'token'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  💎 Token
                </button>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={analyzeInput}
                  onChange={(e) => setAnalyzeInput(e.target.value)}
                  placeholder={
                    analyzeType === 'cast'
                      ? 'Paste cast URL or hash...'
                      : analyzeType === 'user'
                      ? 'Enter username or FID...'
                      : 'Enter token name, symbol, or address...'
                  }
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                />
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !analyzeInput.trim()}
                  className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
                >
                  {analyzing ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>
            </div>

            {/* Cast Analysis Results */}
            {castAnalysis && analyzeType === 'cast' && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg p-4 border border-purple-500/20 space-y-4">
                {/* Author Info */}
                <div className="flex items-center gap-3 pb-4 border-b border-gray-700">
                  <img 
                    src={castAnalysis.author.pfpUrl} 
                    alt={castAnalysis.author.displayName}
                    className="w-12 h-12 rounded-full border-2 border-purple-400"
                  />
                  <div className="flex-1">
                    <p className="text-white font-semibold">{castAnalysis.author.displayName}</p>
                    <p className="text-gray-400 text-sm">@{castAnalysis.author.username}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-purple-400 font-semibold">{castAnalysis.author.followerCount.toLocaleString()}</p>
                    <p className="text-gray-400">followers</p>
                  </div>
                </div>

                {/* Cast Text */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-white">{castAnalysis.cast.text}</p>
                </div>

                {/* Engagement Metrics */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-pink-400">❤️ {castAnalysis.engagement.likes}</p>
                    <p className="text-xs text-gray-400">Likes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-400">🔁 {castAnalysis.engagement.recasts}</p>
                    <p className="text-xs text-gray-400">Recasts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-400">💬 {castAnalysis.engagement.replies}</p>
                    <p className="text-xs text-gray-400">Replies</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-400">{castAnalysis.engagement.rate}%</p>
                    <p className="text-xs text-gray-400">Rate</p>
                  </div>
                </div>

                {/* Reputation */}
                {castAnalysis.reputation && (
                  <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                    <p className="text-purple-300 font-semibold mb-2">Author Reputation</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Quotient Score</span>
                        <span className="text-white font-bold">{castAnalysis.reputation.quotientScore}/100</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Network Rank</span>
                        <span className="text-white font-bold">#{castAnalysis.reputation.quotientRank.toLocaleString()}</span>
                      </div>
                      {castAnalysis.reputation.contextLabels?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {castAnalysis.reputation.contextLabels.map((label: string) => (
                            <span key={label} className="px-2 py-1 bg-purple-600/50 text-purple-200 text-xs rounded-full">
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        {castAnalysis.reputation.topTrader && (
                          <span className="px-2 py-1 bg-green-600/50 text-green-200 text-xs rounded-full">🏆 Top Trader</span>
                        )}
                        {castAnalysis.reputation.topBuilder && (
                          <span className="px-2 py-1 bg-blue-600/50 text-blue-200 text-xs rounded-full">🔨 Top Builder</span>
                        )}
                        {castAnalysis.reputation.topTokenEvangelist && (
                          <span className="px-2 py-1 bg-yellow-600/50 text-yellow-200 text-xs rounded-full">💎 Token Evangelist</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Analysis Results */}
            {userAnalysis && analyzeType === 'user' && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg p-4 border border-purple-500/20 space-y-4">
                {/* Profile Header */}
                <div className="flex items-start gap-4 pb-4 border-b border-gray-700">
                  <img 
                    src={userAnalysis.profile.pfpUrl} 
                    alt={userAnalysis.profile.displayName}
                    className="w-16 h-16 rounded-full border-2 border-purple-400"
                  />
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white">{userAnalysis.profile.displayName}</h2>
                    <p className="text-gray-400">@{userAnalysis.profile.username}</p>
                    {userAnalysis.profile.bio && (
                      <p className="text-gray-300 text-sm mt-2">{userAnalysis.profile.bio}</p>
                    )}
                    {userAnalysis.activity.powerBadge && (
                      <span className="inline-block mt-2 px-2 py-1 bg-yellow-600/50 text-yellow-200 text-xs rounded-full">
                        ⚡ Power Badge
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-900/50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-purple-400">{userAnalysis.stats.followers.toLocaleString()}</p>
                    <p className="text-gray-400 text-sm mt-1">Followers</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-purple-400">{userAnalysis.stats.following.toLocaleString()}</p>
                    <p className="text-gray-400 text-sm mt-1">Following</p>
                  </div>
                </div>

                {/* Reputation */}
                {userAnalysis.reputation && (
                  <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-purple-300 font-semibold">Reputation Analysis</p>
                      <span className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full font-medium">
                        {userAnalysis.reputation.tier}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Quotient Score</span>
                        <span className="text-white font-bold text-xl">{userAnalysis.reputation.quotientScore}/100</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full transition-all"
                          style={{ width: `${userAnalysis.reputation.quotientScore}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-gray-300">Network Rank</span>
                        <span className="text-white font-bold">#{userAnalysis.reputation.quotientRank.toLocaleString()}</span>
                      </div>
                      {userAnalysis.reputation.contextLabels?.length > 0 && (
                        <div className="pt-3 border-t border-gray-700">
                          <p className="text-gray-400 text-xs mb-2">Context Labels</p>
                          <div className="flex flex-wrap gap-2">
                            {userAnalysis.reputation.contextLabels.map((label: string) => (
                              <span key={label} className="px-2 py-1 bg-purple-600/50 text-purple-200 text-xs rounded-full">
                                {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(userAnalysis.reputation.badges.topTrader || 
                        userAnalysis.reputation.badges.topBuilder || 
                        userAnalysis.reputation.badges.topTokenEvangelist) && (
                        <div className="pt-3 border-t border-gray-700">
                          <p className="text-gray-400 text-xs mb-2">Achievements</p>
                          <div className="flex flex-wrap gap-2">
                            {userAnalysis.reputation.badges.topTrader && (
                              <span className="px-2 py-1 bg-green-600/50 text-green-200 text-xs rounded-full">🏆 Top Trader</span>
                            )}
                            {userAnalysis.reputation.badges.topBuilder && (
                              <span className="px-2 py-1 bg-blue-600/50 text-blue-200 text-xs rounded-full">🔨 Top Builder</span>
                            )}
                            {userAnalysis.reputation.badges.topTokenEvangelist && (
                              <span className="px-2 py-1 bg-yellow-600/50 text-yellow-200 text-xs rounded-full">💎 Token Evangelist</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Verified Addresses */}
                {userAnalysis.profile.verifiedAddresses?.length > 0 && (
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-2">Verified Addresses</p>
                    <div className="space-y-1">
                      {userAnalysis.profile.verifiedAddresses.map((addr: string) => (
                        <p key={addr} className="text-gray-300 text-xs font-mono">
                          {addr.slice(0, 6)}...{addr.slice(-4)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Token Analysis Results */}
            {tokenAnalysis && analyzeType === 'token' && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg p-4 border border-purple-500/20 space-y-4">
                {/* Investment Rating */}
                <div className={`rounded-lg p-4 border-2 ${
                  tokenAnalysis.summary.investmentRating.includes('SCAM')
                    ? 'bg-red-900/30 border-red-500'
                    : tokenAnalysis.summary.investmentRating.includes('HIGH RISK')
                    ? 'bg-red-900/20 border-red-500/50'
                    : tokenAnalysis.summary.investmentRating.includes('MEDIUM')
                    ? 'bg-yellow-900/20 border-yellow-500/50'
                    : 'bg-green-900/20 border-green-500/50'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">
                      {tokenAnalysis.summary.investmentRating.includes('SCAM') ? '🚨' :
                       tokenAnalysis.summary.investmentRating.includes('HIGH') ? '🔴' :
                       tokenAnalysis.summary.investmentRating.includes('LOW') ? '🟢' : '🟡'}
                    </span>
                    <div className="flex-1">
                      <p className="text-white font-bold text-lg mb-1">
                        {tokenAnalysis.summary.investmentRating}
                      </p>
                      <p className="text-xs text-gray-400">
                        Analyzed: {new Date(tokenAnalysis.summary.lastUpdated).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Risk Factors */}
                {tokenAnalysis.summary.riskFactors.length > 0 && (
                  <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/30">
                    <p className="text-red-300 font-semibold mb-2 flex items-center gap-2">
                      ⚠️ Risk Factors Detected
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tokenAnalysis.summary.riskFactors.map((factor, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 bg-red-600/50 text-red-200 text-xs rounded-full capitalize"
                        >
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detailed Analysis */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-gray-300 font-semibold mb-3">Detailed Analysis</p>
                  <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                    {tokenAnalysis.analysis}
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="bg-yellow-900/20 rounded-lg p-3 border border-yellow-500/30">
                  <p className="text-yellow-300 text-xs leading-relaxed">
                    ⚠️ {tokenAnalysis.disclaimer}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

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
