import { useEffect, useState } from "react";
import { postCast, ready, getCapabilities, openUrl } from "../lib/farcaster";
import FallbackModal from "../components/FallbackModal";

export default function Compose() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportsCompose, setSupportsCompose] = useState<boolean | null>(null);
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const caps = await getCapabilities();
        if (mounted) setSupportsCompose(caps.includes("actions.composeCast"));
      } catch (e) {
        if (mounted) setSupportsCompose(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await ready();
      await postCast(text);
      setText("");
      alert("Posted successfully (or SDK accepted the request)");
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Compose</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          cols={40}
          placeholder="Write a cast..."
        />
        <div>
          {supportsCompose === false && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="muted">Compose action not available in this host.</div>
              <button
                type="button"
                className="btn"
                onClick={() => setOpenModal(true)}
              >
                Open in Farcaster
              </button>
            </div>
          )}
          <button
            type="submit"
            className="btn primary"
            disabled={
              loading || text.trim().length === 0 || supportsCompose === false
            }
          >
            {loading ? "Posting..." : "Post"}
          </button>
        </div>
      </form>
    </section>
  );
}

// render modal outside component tree by simple inclusion — small app, no portal needed
function ComposeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <FallbackModal
      open={open}
      title="Open in Farcaster"
      onClose={onClose}
      onPrimary={async () => await openUrl('https://farcaster.xyz/')}
      primaryLabel="Open Farcaster"
    >
      <p>This host does not expose the native composer. Open the Farcaster client to create a cast.</p>
    </FallbackModal>
  );
}
