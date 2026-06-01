"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useFarcasterWrites } from "@/hooks/useFarcasterWrites";
import SmartEmbed from "@/components/SmartEmbed";

function renderCastText(text: string) {
  const parts = text.split(/(\$[A-Z][A-Z0-9]{0,9})/g);
  return parts.map((part, i) =>
    /^\$[A-Z][A-Z0-9]{0,9}$/.test(part) ? (
      <Link key={i} href={`/tokens/${encodeURIComponent(part.slice(1))}`} style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}>
        {part}
      </Link>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

export default function CastDetailPage() {
  const params = useParams();
  const hash = params?.hash as string;
  const [cast, setCast] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ hash: string; fid: number; name: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const { reply } = useFarcasterWrites();

  const fetchCastDetail = useCallback(async () => {
    if (!hash) return;
    try {
      const response = await fetch(`/api/cast?hash=${encodeURIComponent(hash)}`);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch cast');
      }

      const data = await response.json();
      setCast(data.cast);
    } catch (err: any) {
      console.error('Error fetching cast:', err);
      setError(err.message || 'Failed to load cast');
    }
  }, [hash]);

  useEffect(() => {
    if (!hash) {
      setError("No cast hash provided");
      setLoading(false);
      return;
    }

    fetchCastDetail().finally(() => setLoading(false));
  }, [hash, fetchCastDetail]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-zinc-100 dark:text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-gray-400 dark:text-gray-500">Loading cast...</div>
        </div>
      </div>
    );
  }

  if (error || !cast) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-zinc-100 dark:text-zinc-100 flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="text-4xl mb-4">😔</div>
          <div className="text-xl font-bold mb-2">Cast Not Found</div>
          <div className="text-gray-400 dark:text-gray-500 mb-6">{error || 'Unable to load this cast'}</div>
          <Link href="/" className="text-zinc-400 hover:text-white">
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

  const handleReply = (parentHash: string, parentFid: number, parentName: string) => {
    setReplyingTo({ hash: parentHash, fid: parentFid, name: parentName });
    setReplyText('');
  };

  const submitReply = async () => {
    if (!replyText.trim() || !replyingTo) return;
    setReplying(true);
    try {
      await reply({ text: replyText.trim(), parentCastHash: replyingTo.hash, parentCastFid: replyingTo.fid });
      setReplyingTo(null);
      setReplyText('');
      await fetchCastDetail();
    } catch (e) {
      console.error('Reply failed:', e);
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-100 dark:text-zinc-100">
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
                className="font-bold text-lg hover:text-white transition-colors"
              >
                {authorName}
              </Link>
              <div className="text-sm text-gray-500 dark:text-gray-400">@{authorUsername}</div>
            </div>
          </div>

          {/* Cast Text */}
          <div className="text-base leading-relaxed mb-4 whitespace-pre-wrap break-words">
            {renderCastText(text)}
          </div>

          {/* Embeds */}
          {embeds.length > 0 && (
            <div className="space-y-3">
              {embeds.map((embed: any, idx: number) => {
                if (!embed.url) return null;
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
                return <SmartEmbed key={idx} url={embed.url} castHash={cast.hash} />;
              })}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800">
            {timeLabel}
          </div>

          {/* Reactions + Reply */}
          <div className="flex items-center gap-6 mt-4 text-sm text-gray-600 dark:text-gray-400">
            <div>❤️ {cast.reactions?.likes_count || 0} likes</div>
            <div>🔁 {cast.reactions?.recasts_count || 0} recasts</div>
            <div>💬 {cast.replies?.count || 0} replies</div>
            <button
              onClick={() => handleReply(cast.hash, cast.author?.fid, authorName)}
              className="ml-auto text-zinc-500 hover:text-zinc-200 transition-colors text-xs"
            >
              Reply
            </button>
          </div>
        </div>

        {/* Inline reply composer */}
        {replyingTo && (
          <div className="mb-6 p-4 bg-zinc-900 border border-zinc-700 rounded-xl">
            <div className="text-xs text-zinc-500 mb-2">Replying to {replyingTo.name}</div>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write your reply..."
              rows={3}
              className="w-full bg-zinc-800 text-zinc-100 text-sm rounded-lg p-3 resize-none border border-zinc-700 focus:outline-none focus:border-zinc-500"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setReplyingTo(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={submitReply}
                disabled={replying || !replyText.trim()}
                className="px-4 py-1.5 text-xs bg-zinc-100 text-black rounded-full font-medium disabled:opacity-40 hover:bg-white transition-colors"
              >
                {replying ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        )}

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
                            className="font-bold hover:text-white transition-colors"
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
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">{replyTimeLabel}</span>
                          <button
                            onClick={() => handleReply(reply.hash, replyAuthor?.fid, replyAuthorName)}
                            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
                          >
                            Reply
                          </button>
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
