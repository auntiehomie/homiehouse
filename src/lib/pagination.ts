/**
 * Cursor-based pagination helpers.
 * Pattern mirrors @farcasterxyz/client — responses carry a `next_cursor` (or
 * `next` containing a `cursor`) that is passed back to load the next page.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  results: T[];
  next_cursor: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract the next page cursor from the most recent page.
 * Hypersnap returns `next: { cursor }`; this normalises that shape as well as
 * the flat `next_cursor` field.
 */
export function getNextPageCursor<T>(
  lastPage: PaginatedResponse<T> | any
): string | undefined {
  if (!lastPage) return undefined;
  // Flat next_cursor
  if (typeof lastPage.next_cursor === 'string' && lastPage.next_cursor.length > 0) {
    return lastPage.next_cursor;
  }
  // Nested { next: { cursor } }
  if (lastPage.next?.cursor && typeof lastPage.next.cursor === 'string') {
    return lastPage.next.cursor;
  }
  // Casts array with `next` key (feed responses)
  if (lastPage.next && typeof lastPage.next === 'object') {
    const c = (lastPage.next as Record<string, unknown>).cursor;
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return undefined;
}

/**
 * Type-safe adapter that wraps a fetcher so its cursor argument is
 * optional in the public signature yet required when the fetcher
 * actually executes.  Useful for standardising the call-site shape.
 */
export function wrapPaginatedFetcher<
  TArgs,
  TResponse extends PaginatedResponse<unknown>
>(
  fetcher: (args: TArgs & { cursor: string | undefined }) => Promise<TResponse>,
): (args: TArgs & { cursor?: string | undefined }) => Promise<TResponse> {
  return (args) => fetcher(args as TArgs & { cursor: string | undefined });
}