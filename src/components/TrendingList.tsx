"use client";

import React, { useEffect, useState } from "react";
import { TrendingSkeleton } from "./Skeletons";
import { formatDistanceToNow } from "date-fns";

export default function TrendingList() {
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams({ limit: String(10), time_window: "24h" });
        
        // Get FID from localStorage if available
        const storedProfile = localStorage.getItem("hh_profile");
        if (storedProfile) {
          try {
            const profile = JSON.parse(storedProfile);
            if (profile?.fid) {
              params.set("viewer_fid", String(profile.fid));
            }
          } catch {}
        }
        
        const res = await fetch(`/api/trending?${params.toString()}`);
        const data = await res.json();
        const casts = data?.data ?? [];
        if (mounted) setItems(Array.isArray(casts) ? casts : []);
      } catch (e) {
        if (mounted) setItems([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (items === null)
    return (
      <div aria-busy="true" aria-live="polite">
        <TrendingSkeleton count={2} />
      </div>
    );
  if (!items.length) return <div className="surface">No trending casts.</div>;

  return (
    <div className="space-y-3">
      {items.map((it) => {
        const authorObj = it?.author || it?.user || null;
        const authorName = authorObj?.display_name || authorObj?.username || "Unknown";
        const text = it?.text || it?.body || "";
        const rawTs = it?.timestamp || it?.ts || it?.time || null;
        let timeLabel = "";
        if (rawTs) {
          try {
            const date = new Date(String(rawTs));
            if (!isNaN(date.getTime())) {
              timeLabel = formatDistanceToNow(date, { addSuffix: true });
            }
          } catch {}
        }

        return (
          <div key={it?.hash ?? it?.id ?? JSON.stringify(it)} className="surface">
            <div style={{ fontWeight: 700 }}>{authorName}</div>
            <div style={{ marginTop: 6, wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>{text}</div>
            {timeLabel ? <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted-on-dark)'}}>{timeLabel}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
