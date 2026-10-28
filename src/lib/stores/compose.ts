/**
 * Compose state — ephemeral UI atoms for the cast composer.
 * Jotai atoms are lazily evaluated, so accessing them anywhere in the tree
 * that is wrapped by FarcasterAuthProvider works without prop drilling.
 */

import { atom } from 'jotai';

/** Whether the compose modal is currently visible. */
export const composeModalOpenAtom = atom(false);

/** Draft text body — kept in sync with the editor state. */
export const composeDraftTextAtom = atom('');

/** Selected channel key (e.g. "farcaster", "base"). Empty = no channel. */
export const composeSelectedChannelAtom = atom('');

/** URIs of images attached to the current draft. */
export const composeImageAttachmentsAtom = atom<string[]>([]);

/** Whether the cast should be scheduled for later. */
export const composeIsScheduledAtom = atom(false);

/** Scheduled time in ISO-8601 (empty = not scheduled). */
export const composeScheduledTimeAtom = atom('');