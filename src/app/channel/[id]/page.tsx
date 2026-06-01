"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import FeedList from '@/components/FeedList';

interface ChannelInfo {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  member_count?: number;
  follower_count?: number;
  created_at?: string;
}

export default function ChannelPage() {
  const params = useParams();
  const channelId = params?.id as string;
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [hiddenCasts, setHiddenCasts] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<ChannelInfo | null>(null);

  useEffect(() => {
    if (!channelId) return;
    fetch(`/api/channel?id=${encodeURIComponent(channelId)}`)
      .then(r => r.json())
      .then(data => { if (data.ok && data.channel) setChannel(data.channel); })
      .catch(() => {});
  }, [channelId]);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', minHeight: '100vh' }}>
      {/* Channel header */}
      <div style={{ position: 'relative', marginBottom: '0' }}>
        {/* Banner / gradient background */}
        <div style={{
          height: '80px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          position: 'relative',
        }} />

        <div style={{ padding: '0 20px 16px' }}>
          {/* Channel icon */}
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '3px solid #000',
            background: '#1e1e2e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '-28px',
            marginBottom: '12px',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {channel?.image_url ? (
              <img src={channel.image_url} alt={channelId} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 20, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>
                {channelId.slice(0, 2)}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                {channel?.name || `#${channelId}`}
              </h1>
              <p style={{ fontSize: 13, color: '#888', margin: '2px 0 0' }}>/{channelId}</p>
            </div>
            <Link
              href="/"
              style={{
                fontSize: 13,
                color: '#666',
                textDecoration: 'none',
                padding: '6px 12px',
                border: '1px solid #333',
                borderRadius: 20,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              ← Back
            </Link>
          </div>

          {channel?.description && (
            <p style={{ fontSize: 14, color: '#aaa', marginTop: 8, lineHeight: 1.5 }}>
              {channel.description}
            </p>
          )}

          {channel?.member_count != null && (
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13 }}>
              <span>
                <strong style={{ color: '#fff' }}>{channel.member_count.toLocaleString()}</strong>
                <span style={{ color: '#666', marginLeft: 4 }}>members</span>
              </span>
              {channel.follower_count != null && (
                <span>
                  <strong style={{ color: '#fff' }}>{channel.follower_count.toLocaleString()}</strong>
                  <span style={{ color: '#666', marginLeft: 4 }}>followers</span>
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ height: 1, background: '#222' }} />
      </div>

      {/* Feed */}
      <div style={{ padding: '0 20px' }}>
        {channelId && (
          <FeedList
            feedType="global"
            selectedChannel={channelId}
            mutedUsers={mutedUsers}
            hiddenCasts={hiddenCasts}
            onMuteUser={(username: string) => setMutedUsers(prev => new Set([...prev, username]))}
            onHideCast={(hash: string) => setHiddenCasts(prev => new Set([...prev, hash]))}
          />
        )}
      </div>
    </div>
  );
}
