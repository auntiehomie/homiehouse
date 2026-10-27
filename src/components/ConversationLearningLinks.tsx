'use client';

import Link, { useLinkStatus } from 'next/link';
import TypingDots from './TypingDots';
import { conversationLearningUrl } from '@/lib/conversation-learning';

interface Props {
  cast: { hash?: string; text: string; author: unknown };
}

function PendingLabel({ children }: { children: string }) {
  const { pending } = useLinkStatus();
  return <>{children}{pending && <TypingDots label="Opening Ask Homie" />}</>;
}

export default function ConversationLearningLinks({ cast }: Props) {
  return (
    <div aria-label="Learn from this cast" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 8, fontSize: 12 }} onClick={event => event.stopPropagation()}>
      <span style={{ color: 'var(--muted-on-dark, #999)' }}>Learn from this cast:</span>
      <Link prefetch={false} href={conversationLearningUrl(cast, 'explain')} style={{ color: 'var(--muted-on-dark, #b8b8b8)', textDecoration: 'underline', textUnderlineOffset: 2 }}><PendingLabel>Explain</PendingLabel></Link>
      <Link prefetch={false} href={conversationLearningUrl(cast, 'lesson')} style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 2 }}><PendingLabel>Build a lesson with Ask Homie</PendingLabel></Link>
    </div>
  );
}
