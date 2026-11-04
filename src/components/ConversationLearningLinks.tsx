'use client';

import Link, { useLinkStatus } from 'next/link';
import { useRouter } from 'next/navigation';
import TypingDots from './TypingDots';
import { conversationLearningPlanUrl, conversationLearningUrl } from '@/lib/conversation-learning';

interface Props {
  cast: { hash?: string; text: string; author: unknown };
}

function PendingLabel({ children }: { children: string }) {
  const { pending } = useLinkStatus();
  return <>{children}{pending && <TypingDots label="Opening Ask Homie" />}</>;
}

export default function ConversationLearningLinks({ cast }: Props) {
  const router = useRouter();

  return (
    <div aria-label="Learn from this cast" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 10, fontSize: 12 }} onClick={event => event.stopPropagation()}>
      <span style={{ color: 'var(--muted-on-dark, #999)' }}>Learn from this cast:</span>
      <Link prefetch={false} href={conversationLearningUrl(cast, 'explain')} style={{ color: 'var(--muted-on-dark, #b8b8b8)', textDecoration: 'underline', textUnderlineOffset: 2 }}><PendingLabel>Explain</PendingLabel></Link>
      <button
        type="button"
        title="Eligible signed-in learners can earn 100 HH2 by passing the lesson quiz."
        aria-label="Build a lesson from this cast and earn HH2"
        onClick={() => {
          let storage: Storage | undefined;
          try { storage = window.sessionStorage; } catch { storage = undefined; }
          router.push(conversationLearningPlanUrl(cast, storage));
        }}
        style={{ border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)', borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', padding: '6px 10px', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}
      >
        Learn & earn HH2 ↗
      </button>
      <span style={{ flexBasis: '100%', color: 'var(--muted-on-dark, #999)', fontSize: 11 }}>Pass the quiz while signed in to earn 100 HH2.</span>
    </div>
  );
}
