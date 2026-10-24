'use client';

import { useState } from 'react';
import type { LessonContent } from '@/lib/lesson-client-cache';
import styles from './LessonWalkthrough.module.css';

/** Reuses lesson copy verbatim; stages indicate reading order, not causality. */
export default function LessonWalkthrough({ lesson }: { lesson: LessonContent }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [replay, setReplay] = useState(0);
  const stages = [
    { title: 'Start here', text: lesson.intro },
    ...lesson.concepts.map(concept => ({ title: concept.title, text: concept.explanation, analogy: concept.analogy })),
    { title: 'In practice', text: lesson.practicalExample },
    { title: 'Try it', text: lesson.quickActions.join('\n\n') },
    { title: 'Takeaway', text: lesson.summary },
  ].filter(stage => stage.text?.trim());
  const selected = Math.min(index, Math.max(0, stages.length - 1));
  const stage = stages[selected];
  if (!stage) return null;

  return (
    <section className={styles.root} aria-label="Lesson visual walkthrough" onTouchStart={event => event.stopPropagation()} onTouchEnd={event => event.stopPropagation()}>
      <button type="button" className={styles.button} aria-expanded={open} onClick={() => setOpen(value => !value)}>
        {open ? 'Close visual walkthrough' : 'Explore visual walkthrough'}
      </button>
      {open && (
        <div className={styles.layout}>
          <nav aria-label="Walkthrough stages" className={styles.stages}>
            {stages.map((item, i) => (
              <button key={i} type="button" className={styles.stage} aria-current={i === selected ? 'step' : undefined} onClick={() => setIndex(i)}>
                <span aria-hidden="true" className={styles.number}>{i + 1}</span>
                <span>{item.title}</span>
              </button>
            ))}
          </nav>
          <div className={styles.detail}>
            <div key={`${selected}:${replay}`} className={styles.scene}>
              <span className={styles.caption}>Stage {selected + 1} of {stages.length}</span>
              <h3>{stage.title}</h3>
              <p className={styles.copy}>{stage.text}</p>
              {'analogy' in stage && stage.analogy && <blockquote><strong>Analogy</strong><p>{stage.analogy}</p></blockquote>}
            </div>
            <div className={styles.controls}>
              <button type="button" className={styles.button} disabled={selected === 0} onClick={() => setIndex(selected - 1)}>Previous</button>
              <button type="button" className={styles.button} onClick={() => setReplay(value => value + 1)}>Replay reveal</button>
              <button type="button" className={styles.button} disabled={selected === stages.length - 1} onClick={() => setIndex(selected + 1)}>Next</button>
            </div>
            <span className={styles.status} role="status">Stage {selected + 1} of {stages.length}: {stage.title}</span>
          </div>
        </div>
      )}
    </section>
  );
}
