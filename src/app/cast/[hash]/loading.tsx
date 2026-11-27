export default function CastLoading() {
  return (
    <div
      role="status"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--muted-on-dark, #999)' }}
    >
      Loading cast…
    </div>
  );
}
