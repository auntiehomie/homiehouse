export const MIGRATION_GUIDE_KEY = 'hh_migration_guide_v1';
export const OPEN_MIGRATION_GUIDE = 'hh:open:migration-guide';

/** Existing accounts should not be interrupted by a new visitor introduction. */
export function shouldShowMigrationGuide(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    if (storage.getItem(MIGRATION_GUIDE_KEY)) return false;
    const raw = storage.getItem('hh_profile');
    if (!raw) return true;
    const profile = JSON.parse(raw);
    return !(Number.isSafeInteger(profile?.fid) && profile.fid > 0);
  } catch { return true; }
}

export function dismissMigrationGuide(storage: Pick<Storage, 'setItem'>): void {
  try { storage.setItem(MIGRATION_GUIDE_KEY, 'dismissed'); } catch { /* Browsing still works when storage is blocked. */ }
}
