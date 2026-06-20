"use client";

import React from "react";

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse bg-transparent">
          <div className="surface mb-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-700" />
              <div className="flex-1">
                <div className="h-4 bg-zinc-700 rounded w-1/3 mb-2" />
                <div className="h-3 bg-zinc-700 rounded w-5/6 mb-2" />
                <div className="h-3 bg-zinc-700 rounded w-3/4" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TrendingSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="surface mb-3 p-3">
            <div className="h-4 bg-zinc-700 rounded w-1/2 mb-2" />
            <div className="h-3 bg-zinc-700 rounded w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default null;
