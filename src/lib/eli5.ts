/**
 * "Explain Like I'm 5" — a persisted, client-side preference that tells AI
 * features (Ask Homie, lesson generation) to explain things in very plain
 * language instead of assuming crypto/web3 familiarity.
 *
 * Same storage pattern as the theme preference in settings/page.tsx
 * (localStorage, read on mount, no server-side persistence — it's a
 * per-device reading preference, not account state).
 */

export const ELI5_STORAGE_KEY = 'hh_eli5_mode';

export function getEli5Mode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ELI5_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setEli5Mode(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ELI5_STORAGE_KEY, on ? 'true' : 'false');
  } catch {
    // localStorage unavailable (private browsing, quota) — fail silently, same as elsewhere in this codebase
  }
}

/** The instruction injected into AI prompts when ELI5 mode is on. */
export const ELI5_INSTRUCTION =
  '[SIMPLE MODE: Explain everything in very plain, simple language — like talking to someone completely new to crypto/web3. Avoid jargon; if you have to use a technical term, define it immediately in plain words right there. Short sentences. Friendly, patient tone, no assumed background knowledge.]';
