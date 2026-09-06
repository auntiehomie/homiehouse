/**
 * Global UI state atoms — layout and modal visibility.
 */

import { atom } from 'jotai';

/** Whether the desktop sidebar is collapsed. */
export const sidebarCollapsedAtom = atom(false);

/** Whether the welcome / signer-approval modal is visible. */
export const welcomeModalOpenAtom = atom(false);

/** Whether the theme picker modal is visible. */
export const themeModalOpenAtom = atom(false);