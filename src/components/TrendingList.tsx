"use client";

import React, { useEffect, useState } from "react";
import { fetchTrending } from "../lib/farcaster";
import { TrendingSkeleton } from "./Skeletons";
import { formatDistanceToNow } from "date-fns";

export default function TrendingList() {
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetchTrending(10);
      if (mounted) setItems(res);
    })();
    return () => {
      mounted = false;
    };
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
        const rawTs = it.timestamp ?? it.ts ?? it.time ?? null;
        let timeLabel = "";
        if (rawTs) {
          try {
            let date: Date;
            if (typeof rawTs === 'number') {
              date = new Date(rawTs > 1e12 ? rawTs : rawTs * 1000);
            } else {
              date = new Date(String(rawTs));
            }
            if (!isNaN(date.getTime())) {
              timeLabel = formatDistanceToNow(date, { addSuffix: true });
            } else {
              timeLabel = String(rawTs);
            }
          } catch (e) {
            timeLabel = String(rawTs);
          }
        }

        return (
          <div key={it.id ?? JSON.stringify(it)} className="surface">
            <div style={{ fontWeight: 700 }}>{it.author ?? it.handle ?? 'Unknown'}</div>
            <div style={{ marginTop: 6 }}>{it.text ?? it.body ?? JSON.stringify(it)}</div>
            {timeLabel ? <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted-on-dark)'}}>{timeLabel}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
