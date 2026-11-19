'use client';

import LessonAnimation from './LessonAnimation';
import { storyboardForText } from '@/lib/lesson-storyboard';
import TokenizationScene from './TokenizationScene';
import LessonActivity, { lessonActivityFor } from './LessonActivity';
import { useEffect, useState } from 'react';
import { loadExistingLessonScene } from '@/lib/lesson-scene-client';
import { normalizeLessonScenes, sceneForExistingText, type LessonScene } from '@/lib/lesson-scene';

export default function LessonIllustration({ text, visual }: { text: string; visual?: LessonScene }) {
  return <CardAnimation key={text} text={text} visual={visual} />;
}

function CardAnimation({ text, visual }: { text: string; visual?: LessonScene }) {
  const activity = lessonActivityFor(text);
  const builtIn = storyboardForText(text);
  const saved = normalizeLessonScenes([visual], text)[0];
  const tokenization = saved?.layout === 'tokenization' ? saved : sceneForExistingText(text);
  const storyboard = builtIn ?? (saved?.layout === 'storyboard' && saved.source === text.trim() ? saved : undefined);
  const [generated, setGenerated] = useState<LessonScene | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (storyboard || tokenization?.layout === 'tokenization' || !text.trim()) return;
    let cancelled = false;
    setLoading(true);
    void loadExistingLessonScene(text).then(plan => {
      if (!cancelled) { setGenerated(plan); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [text, Boolean(storyboard), tokenization?.layout, attempt]);
  const plan = storyboard ?? (generated?.layout === 'storyboard' ? generated : undefined);
  return <>
    {tokenization?.layout === 'tokenization' ? <TokenizationScene key={text} sample={tokenization.sample} />
      : plan ? <LessonAnimation plan={plan} />
      : <p role="status" style={{ fontSize: 14, color: 'var(--muted-on-dark)' }}>
        {loading ? 'Preparing the animated explanation…' : <button type="button" onClick={() => setAttempt(attempt + 1)}>Retry animated explanation</button>}
      </p>}
    {activity && <LessonActivity key={text} activity={activity} />}
  </>;
}
