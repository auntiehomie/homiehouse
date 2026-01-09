"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ChannelsList() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedProfile = localStorage.getItem("hh_profile");
    if (storedProfile) {
      try {
        const profile = JSON.parse(storedProfile);
        const fid = profile?.fid;
        
        if (fid) {
          // Fetch user's followed channels
          fetchChannels(fid);
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchChannels(fid: number) {
    try {
      // Fetch user's followed channels from API
      const response = await fetch(`/api/channels?fid=${fid}`);
      const data = await response.json();
      
      if (data.ok && data.channels && data.channels.length > 0) {
        // Map channels to our format
        const userChannels = [
          { name: "Home", url: "/", id: "home" },
          ...data.channels.map((ch: any) => ({
            name: ch.name || ch.id,
            url: `/channel/${ch.id}`,
            id: ch.id
          }))
        ];
        
        setChannels(userChannels);
      } else {
        // Fallback to popular channels if user has no followed channels
        const popularChannels = [
          { name: "Home", url: "/", id: "home" },
          { name: "Base", url: "/channel/base", id: "base" },
          { name: "Farcaster", url: "/channel/farcaster", id: "farcaster" },
          { name: "Dev", url: "/channel/dev", id: "dev" },
          { name: "Art", url: "/channel/art", id: "art" },
          { name: "Music", url: "/channel/music", id: "music" },
        ];
        setChannels(popularChannels);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching channels:", error);
      // Fallback to popular channels on error
      const popularChannels = [
        { name: "Home", url: "/", id: "home" },
        { name: "Base", url: "/channel/base", id: "base" },
        { name: "Farcaster", url: "/channel/farcaster", id: "farcaster" },
        { name: "Dev", url: "/channel/dev", id: "dev" },
      ];
      setChannels(popularChannels);
      setLoading(false);
    }
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
          >
            # {channel.name.toLowerCase()}
          </Link>
        ))}
      </div>
    </div>
  );
}
