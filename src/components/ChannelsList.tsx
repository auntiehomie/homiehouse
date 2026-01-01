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
      // For now, show popular channels - you can enhance this to fetch user's actual followed channels
      const popularChannels = [
        { name: "Home", url: "/" },
        { name: "Base", url: "/~/channel/base" },
        { name: "Farcaster", url: "/~/channel/farcaster" },
        { name: "Dev", url: "/~/channel/dev" },
        { name: "Art", url: "/~/channel/art" },
        { name: "Music", url: "/~/channel/music" },
        { name: "NFTs", url: "/~/channel/nft" },
        { name: "Crypto", url: "/~/channel/crypto" },
      ];
      
      setChannels(popularChannels);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching channels:", error);
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
        {channels.map((channel, index) => (
          <Link
            key={index}
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
