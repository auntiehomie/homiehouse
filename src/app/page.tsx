import Link from "next/link";
import ComposeModal from "../components/ComposeModal";
import FeedTrendingTabs from "../components/FeedTrendingTabs";
import TrendingList from "../components/TrendingList";
import SignInWithFarcaster from "../components/SignInWithFarcaster";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-zinc-100">
      <header className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">HomieHouse</h1>
          <nav className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/">Home</Link>
            <span className="px-2">·</span>
            <Link href="/compose">Compose</Link>
            <span className="px-2">·</span>
            <Link href="/dev">Dev</Link>
            <span className="px-2">·</span>
            <Link href="/wiki">Wiki</Link>
          </nav>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ComposeModal />
          {/* Sign-in with Farcaster component */}
          <SignInWithFarcaster />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <section className="mb-8 text-center">
          <h2 className="text-3xl font-bold mb-2">HomieHouse - Your Social Hub</h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">Your place to share what's on your mind</p>
        </section>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <h3 className="text-xl font-semibold mb-4">Explore</h3>
            <FeedTrendingTabs />
          </div>

          <aside className="p-4 border rounded-md">
            <h3 className="font-medium">Trending</h3>
            <TrendingList />
            <div style={{ marginTop: 12 }}>
              <h4 className="font-medium">Dev</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Inspector and SDK tools for debugging the host integration.</p>
              <Link className="mt-3 inline-block text-sm font-medium" href="/dev">Open Dev →</Link>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
            