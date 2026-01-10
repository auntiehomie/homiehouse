"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import FeedList from '@/components/FeedList';

export default function ChannelPage() {
  const params = useParams();
  const channelId = params?.id as string;
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [hiddenCasts, setHiddenCasts] = useState<Set<string>>(new Set());

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '0 auto', 
      padding: '20px',
      minHeight: '100vh'
    }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 700,
          marginBottom: '8px'
        }}>
          #{channelId}
        </h1>
        <p style={{ 
          fontSize: '14px', 
          color: 'var(--foreground-secondary)',
          opacity: 0.7
        }}>
          Channel feed
        </p>
      </div>

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
  );
}
