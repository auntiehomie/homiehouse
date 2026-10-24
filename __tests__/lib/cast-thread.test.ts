import { buildReplyTree } from '@/lib/cast-thread';

const cast = (hash: string, parent_hash: string) => ({ hash, parent_hash });

test('groups replies beneath the parent cast while preserving page order', () => {
  const tree = buildReplyTree([
    cast('reply-a', 'root'),
    cast('nested-a', 'reply-a'),
    cast('reply-b', 'root'),
  ], 'root');

  expect(tree.map((node) => node.hash)).toEqual(['reply-a', 'reply-b']);
  expect(tree[0].threadChildren.map((node) => node.hash)).toEqual(['nested-a']);
});

test('keeps replies with missing, external, or cyclic parents visible at the top level', () => {
  const tree = buildReplyTree([
    cast('orphan', 'outside-page'),
    cast('cycle-a', 'cycle-b'),
    cast('cycle-b', 'cycle-a'),
    cast('duplicate', 'root'),
    cast('0xduplicate', 'root'),
  ], 'root');

  expect(tree.map((node) => node.hash)).toEqual(['orphan', 'cycle-a', 'cycle-b', 'duplicate']);
});
