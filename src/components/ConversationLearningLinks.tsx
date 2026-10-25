'use client';

import Link from 'next/link';
import { conversationLearningUrl } from '@/lib/conversation-learning';

interface Props {
  cast: { hash?: string; text: string; author: unknown };
}

export default function ConversationLearningLinks({ cast }: Props) {
  return (
    <div aria-label="Learn from this conversation" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }} onClick={event => event.stopPropagation()}>
      <Link className="btn" prefetch={false} href={conversationLearningUrl(cast, 'explain')}>Explain in plain English</Link>
      <Link className="btn" prefetch={false} href={conversationLearningUrl(cast, 'lesson')}>Build me a lesson</Link>
    </div>
  );
}
