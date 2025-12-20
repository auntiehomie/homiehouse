import Link from "next/link";

export const metadata = {
  title: 'Crypto Wiki - HomieHouse',
  description: 'A small crypto glossary and wiki for the HomieHouse app',
};

export default function WikiPage() {
  const entries = [
    { term: 'Farcaster', desc: 'A decentralized social network protocol for social graphs.' },
    { term: 'ETH', desc: 'Ethereum, the blockchain used for smart contracts.' },
    { term: 'DAO', desc: 'Decentralized Autonomous Organization.' },
  ];

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-black text-black dark:text-white">
      <main className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4">Crypto Wiki</h1>
        <p className="mb-6">A quick glossary to help HomieHouse users understand common crypto terms.</p>

        <div className="space-y-4">
          {entries.map((e) => (
            <div key={e.term} className="surface">
              <div style={{ fontWeight: 700 }}>{e.term}</div>
              <div style={{ marginTop: 6 }}>{e.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <Link href="/">← Back to Home</Link>
        </div>
      </main>
    </div>
  );
}
