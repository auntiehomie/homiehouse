/**
 * Feed state — active tab and channel filter for the main feed view.
 */

import { atom } from 'jotai';

export type FeedTab = 'following' | 'trending' | 'channel';

/** The currently active feed tab. */
export const activeFeedTabAtom = atom<FeedTab>('following');

/** Selected channel filter (used when tab === 'channel'). */
export const selectedChannelFilterAtom = atom('');