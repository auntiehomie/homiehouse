"use client";

import ComposeModal from "@/components/ComposeModal";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ComposePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100">
      <header className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold">New Cast</h1>
          <div className="w-6" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6">
        <ComposeModal />
      </main>
    </div>
  );
}
