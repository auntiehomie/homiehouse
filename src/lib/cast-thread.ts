export type ReplyCastLike = {
  hash?: string | null;
  parent_hash?: string | null;
  parentHash?: string | null;
  [key: string]: unknown;
};

export type ReplyThreadNode<T extends ReplyCastLike> = T & {
  threadChildren: ReplyThreadNode<T>[];
};

function keyFor(hash: string | null | undefined): string {
  return (hash ?? '').trim().toLowerCase().replace(/^0x/, '');
}

/** Build the visible reply tree from a page of direct replies. Replies whose
 * parent is outside the page stay at the top level, which keeps pagination and
 * partial Hypersnap results useful without inventing a parent relationship. */
export function buildReplyTree<T extends ReplyCastLike>(
  replies: T[],
  rootHash: string,
): ReplyThreadNode<T>[] {
  const unique: T[] = [];
  const seen = new Set<string>();
  for (const reply of replies) {
    const key = keyFor(reply.hash);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    unique.push(reply);
  }

  const nodes = unique.map((reply) => ({ ...reply, threadChildren: [] as ReplyThreadNode<T>[] }));
  const byHash = new Map<string, ReplyThreadNode<T>>();
  const parentByHash = new Map<string, string>();
  nodes.forEach((node, index) => {
    const key = keyFor(node.hash) || `missing-${index}`;
    byHash.set(key, node);
    parentByHash.set(key, keyFor(node.parent_hash ?? node.parentHash));
  });

  const rootKey = keyFor(rootHash);
  const roots: ReplyThreadNode<T>[] = [];
  nodes.forEach((node, index) => {
    const key = keyFor(node.hash) || `missing-${index}`;
    const parentKey = parentByHash.get(key) ?? '';
    const parent = parentKey && parentKey !== rootKey ? byHash.get(parentKey) : undefined;

    // Malformed or cyclic parent metadata should never hide a reply.
    let cursor = parentKey;
    const visited = new Set<string>();
    let cyclic = false;
    while (cursor && !visited.has(cursor)) {
      if (cursor === key) {
        cyclic = true;
        break;
      }
      visited.add(cursor);
      cursor = parentByHash.get(cursor) ?? '';
    }

    if (parent && !cyclic) parent.threadChildren.push(node);
    else roots.push(node);
  });

  return roots;
}
