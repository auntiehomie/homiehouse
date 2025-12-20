import { useEffect, useState } from "react";
import { fetchFeed } from "../lib/farcaster";

export default function Feed() {
  const [items, setItems] = useState<Array<{ id?: string; text: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const res = await fetchFeed(20);
      if (!mounted) return;
      setItems(res.map((r) => ({ id: r.id, text: r.text })));
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section>
      <h2>Feed</h2>
      {loading && <div>Loading feed…</div>}
      {!loading && items.length === 0 && <div>No items yet.</div>}
      <ul>
        {items.map((it) => (
          <li key={it.id ?? Math.random()}>{it.text}</li>
        ))}
      </ul>
    </section>
  );
}
