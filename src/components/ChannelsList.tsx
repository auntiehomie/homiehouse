"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ChannelsList() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserChannels = () => {
      const storedProfile = localStorage.getItem("hh_profile");
      if (storedProfile) {
        try {
          const profile = JSON.parse(storedProfile);
          const fid = profile?.fid;
          
          if (fid) {
            console.log('[ChannelsList] Fetching channels for FID:', fid);
            fetchChannels(fid);
            return;
          }
        } catch (err) {
          console.error('[ChannelsList] Error parsing profile:', err);
        }
      }
      
      // If no profile, show popular channels
      console.log('[ChannelsList] No profile found, showing popular channels');
      showPopularChannels();
    };

    loadUserChannels();
  }, []);

  async function fetchChannels(fid: number) {
    try {
      console.log('[ChannelsList] Fetching channels for FID:', fid);
      const response = await fetch(`/api/channels?fid=${fid}`);
      const data = await response.json();
      
      console.log('[ChannelsList] API response:', data);
      
      if (data.ok && data.channels && data.channels.length > 0) {
        // Map channels to our format
        const userChannels = [
          { name: "Home", url: "/", id: "home" },
          ...data.channels.slice(0, 10).map((ch: any) => ({
            name: ch.name || ch.id,
            url: `/channel/${ch.id}`,
            id: ch.id
          }))
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
  }

  function showPopularChannels() {
    const popularChannels = [
      { name: "Home", url: "/", id: "home" },
      { name: "Base", url: "/channel/base", id: "base" },
      { name: "Farcaster", url: "/channel/farcaster", id: "farcaster" },
      { name: "Dev", url: "/channel/dev", id: "dev" },
      { name: "Art", url: "/channel/art", id: "art" },
      { name: "Music", url: "/channel/music", id: "music" },
    ];
    setChannels(popularChannels);
    setLoading(false);
  }

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
