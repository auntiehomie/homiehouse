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
    <div aria-label="Learn from this conversation" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }} onClick={event => event.stopPropagation()}>
      <Link className="btn" prefetch={false} href={conversationLearningUrl(cast, 'explain')}><PendingLabel>Explain in plain English</PendingLabel></Link>
      <Link className="btn" prefetch={false} href={conversationLearningUrl(cast, 'lesson')}><PendingLabel>Build me a lesson</PendingLabel></Link>
    </div>
  );
}
