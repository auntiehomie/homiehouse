"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useNeynarContext } from "@neynar/react";

type Channel = {
  name: string;
  url: string;
  id: string;
};

type ApiChannel = {
  id: string;
  name?: string | null;
};

export default function ChannelsList() {
  const { user, isAuthenticated } = useNeynarContext();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const showPopularChannels = useCallback(() => {
    const popularChannels: Channel[] = [
      { name: "Home", url: "/", id: "home" },
      { name: "Base", url: "/channel/base", id: "base" },
      { name: "Farcaster", url: "/channel/farcaster", id: "farcaster" },
      { name: "Dev", url: "/channel/dev", id: "dev" },
      { name: "Art", url: "/channel/art", id: "art" },
      { name: "Music", url: "/channel/music", id: "music" },
    ];
    setChannels(popularChannels);
    setLoading(false);
  }, []);

  const fetchChannels = useCallback(async (fid: number) => {
    try {
      console.log('[ChannelsList] Fetching channels for FID:', fid);
      const response = await fetch(`/api/channels?fid=${fid}`);
      const data = (await response.json()) as { ok?: boolean; channels?: ApiChannel[] };

      console.log('[ChannelsList] API response:', data);

      if (data.ok && data.channels && data.channels.length > 0) {
        // Map channels to our format
        const userChannels: Channel[] = [
          { name: "Home", url: "/", id: "home" },
          ...data.channels.slice(0, 10).map((ch) => ({
            name: ch.name || ch.id,
            url: `/channel/${ch.id}`,
            id: ch.id,
          })),
        ];

        console.log('[ChannelsList] Loaded user channels:', userChannels.length);
        setChannels(userChannels);
      } else {
        console.log('[ChannelsList] No channels found, using popular');
        showPopularChannels();
      }

      setLoading(false);
    } catch (error) {
      console.error("[ChannelsList] Error fetching channels:", error);
      showPopularChannels();
      setLoading(false);
    }
  }, [showPopularChannels]);

  useEffect(() => {
    const loadUserChannels = () => {
      // First try to use the Neynar context user
      if (isAuthenticated && user?.fid) {
        console.log('[ChannelsList] Fetching channels for authenticated user FID:', user.fid);
        fetchChannels(user.fid);
        return;
      }

      // Fallback to localStorage
      const storedProfile = localStorage.getItem("hh_profile");
      if (storedProfile) {
        try {
          const profile = JSON.parse(storedProfile) as { fid?: number };
          const fid = profile?.fid;
          
          if (fid) {
            console.log('[ChannelsList] Fetching channels from stored profile FID:', fid);
            fetchChannels(fid);
            return;
          }
        } catch (err) {
          console.error('[ChannelsList] Error parsing profile:', err);
        }
      }
      
      // If no profile, show popular channels
      console.log('[ChannelsList] No user found, showing popular channels');
      showPopularChannels();
    };

    loadUserChannels();
  }, [fetchChannels, isAuthenticated, showPopularChannels, user]); // Re-run when auth state changes

  if (loading) {
    return null;
  }

  if (channels.length === 0) {
    return null;
  }

  return (
    <div className="channels-list">
      <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: 'var(--foreground)' }}>
        Channels
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {channels.map((channel) => (
          <Link
            key={channel.id || channel.url}
            href={channel.url}
            className="channel-link"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              maxWidth: '100%'
            }}
          >
            # {channel.name.toLowerCase()}
          </Link>
        ))}
      </div>
    </div>
  );
}
