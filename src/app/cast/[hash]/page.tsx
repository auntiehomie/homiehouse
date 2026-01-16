"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

function CastDetailContent() {
  const searchParams = useSearchParams();
  const hash = searchParams.get("hash");
  const [cast, setCast] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hash) {
      setError("No cast hash provided");
      setLoading(false);
      return;
    }

    const fetchCastDetail = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
        
        // Try to fetch from our API first (would need to create this endpoint)
        const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`, {
          headers: {
            'accept': 'application/json',
            'api_key': '8C6F1E4E-677E-419A-A8C7-EF849B0E366B',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch cast');
        }

        const data = await response.json();
        setCast(data.cast);
      } catch (err: any) {
        console.error('Error fetching cast:', err);
        setError(err.message || 'Failed to load cast');
      } finally {
        setLoading(false);
      }
    };

    fetchCastDetail();
  }, [hash]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-gray-400 dark:text-gray-500">Loading cast...</div>
        </div>
      </div>
    );
  }

  if (error || !cast) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100 flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="text-4xl mb-4">😔</div>
          <div className="text-xl font-bold mb-2">Cast Not Found</div>
          <div className="text-gray-400 dark:text-gray-500 mb-6">{error || 'Unable to load this cast'}</div>
          <Link href="/" className="text-orange-600 hover:text-orange-700 dark:text-orange-500 dark:hover:text-orange-400">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const author = cast.author;
  const authorName = author?.display_name || author?.username || 'Unknown';
  const authorUsername = author?.username || '';
  const authorPfp = author?.pfp_url;
  const text = cast.text || '';
  const timestamp = cast.timestamp;
  let timeLabel = '';
  
  if (timestamp) {
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        timeLabel = formatDistanceToNow(date, { addSuffix: true });
      }
    } catch (e) {}
  }

  const embeds = cast.embeds || [];
  const replies = cast.replies?.casts || cast.direct_replies || [];

  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-6 transition-colors"
        >
          ← Back
        </Link>

        {/* Main Cast */}
        <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          {/* Author Info */}
          <div className="flex items-start gap-3 mb-4">
            {authorPfp && (
              <img 
                src={authorPfp} 
                alt={authorName}
                className="w-12 h-12 rounded-full border-2 border-gray-300 dark:border-zinc-700"
              />
            )}
            <div className="flex-1">
              <Link 
                href={`/profile?user=${authorUsername}`}
                className="font-bold text-lg hover:text-orange-600 dark:hover:text-orange-500 transition-colors"
              >
                {authorName}
              </Link>
              <div className="text-sm text-gray-500 dark:text-gray-400">@{authorUsername}</div>
            </div>
          </div>

          {/* Cast Text */}
          <div className="text-base leading-relaxed mb-4 whitespace-pre-wrap break-words">
            {text}
          </div>

          {/* Embeds */}
          {embeds.length > 0 && (
            <div className="space-y-3">
              {embeds.map((embed: any, idx: number) => {
                if (embed.url) {
                  // Check if it's an image
                  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(embed.url) || 
                                /imagedelivery\.net|imgur\.com/i.test(embed.url);
                  
                  if (isImage) {
                    return (
                      <img 
                        key={idx}
                        src={embed.url} 
                        alt="Cast embed"
                        className="w-full rounded-lg border border-gray-200 dark:border-zinc-700"
                      />
                    );
                  }
                  
                  // Otherwise, show as a link
                  return (
                    <a 
                      key={idx}
                      href={embed.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block p-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:border-orange-500 transition-colors"
                    >
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{embed.url}</div>
                    </a>
                  );
                }
                return null;
              })}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800">
            {timeLabel}
          </div>

          {/* Reactions */}
          <div className="flex gap-6 mt-4 text-sm text-gray-600 dark:text-gray-400">
            <div>❤️ {cast.reactions?.likes_count || 0} likes</div>
            <div>🔁 {cast.reactions?.recasts_count || 0} recasts</div>
            <div>💬 {cast.replies?.count || 0} replies</div>
          </div>
        </div>

        {/* Replies Section */}
        {replies.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Replies ({replies.length})</h2>
            <div className="space-y-4">
              {replies.map((reply: any, idx: number) => {
                const replyAuthor = reply.author;
                const replyAuthorName = replyAuthor?.display_name || replyAuthor?.username || 'Unknown';
                const replyAuthorUsername = replyAuthor?.username || '';
                const replyAuthorPfp = replyAuthor?.pfp_url;
                const replyText = reply.text || '';
                const replyTimestamp = reply.timestamp;
                let replyTimeLabel = '';
                
                if (replyTimestamp) {
                  try {
                    const date = new Date(replyTimestamp);
                    if (!isNaN(date.getTime())) {
                      replyTimeLabel = formatDistanceToNow(date, { addSuffix: true });
                    }
                  } catch (e) {}
                }

                return (
                  <div 
                    key={reply.hash || idx}
                    className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3">
                      {replyAuthorPfp && (
                        <img 
                          src={replyAuthorPfp} 
                          alt={replyAuthorName}
                          className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-zinc-700"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link 
                            href={`/profile?user=${replyAuthorUsername}`}
                            className="font-bold hover:text-orange-600 dark:hover:text-orange-500 transition-colors"
                          >
                            {replyAuthorName}
                          </Link>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            @{replyAuthorUsername}
                          </span>
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {replyText}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {replyTimeLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CastDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-gray-400 dark:text-gray-500">Loading cast...</div>
        </div>
      </div>
    }>
      <CastDetailContent />
    </Suspense>
  );
}
