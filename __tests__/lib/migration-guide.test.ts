import { dismissMigrationGuide, MIGRATION_GUIDE_KEY, shouldShowMigrationGuide } from '@/lib/migration-guide';

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
it('welcomes first-time visitors and remembers dismissal across visits', () => {
  const local = storage();
  expect(shouldShowMigrationGuide(local)).toBe(true);
  dismissMigrationGuide(local);
  expect(local.getItem(MIGRATION_GUIDE_KEY)).toBe('dismissed');
  expect(shouldShowMigrationGuide(local)).toBe(false);
});
it('does not interrupt existing accounts', () => {
  expect(shouldShowMigrationGuide(storage({ hh_profile: JSON.stringify({ fid: 123 }) }))).toBe(false);
});
it.each(['broken', '{}', '{"fid":0}'])('handles invalid cached profiles: %s', profile => {
  expect(shouldShowMigrationGuide(storage({ hh_profile: profile }))).toBe(true);
});
it('allows browsing when storage is unavailable', () => {
  expect(shouldShowMigrationGuide({ getItem: () => { throw new Error('blocked'); } })).toBe(true);
  expect(() => dismissMigrationGuide({ setItem: () => { throw new Error('blocked'); } })).not.toThrow();
});
