'use client';

import { useEffect, useState } from 'react';
import type { LessonStoryboard, AnimatedActor } from '@/lib/lesson-storyboard';
import styles from './LessonAnimation.module.css';

function ActorGlyph({ shape }: { shape: AnimatedActor['shape'] }) {
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
    {shape === 'coin' ? <><circle cx="24" cy="24" r="18"/><path d="M24 11v26m7-21H21a5 5 0 0 0 0 10h6a5 5 0 0 1 0 10H16"/></>
      : shape === 'person' ? <><circle cx="24" cy="12" r="8"/><path d="M8 43v-8a16 16 0 0 1 32 0v8"/></>
      : shape === 'shield' ? <><path d="m24 4 17 7v13c0 10-17 20-17 20S7 34 7 24V11Z"/><path d="m15 24 6 6 12-13"/></>
      : shape === 'document' ? <><path d="M11 3h19l8 8v34H11Zm19 0v10h8M17 22h15M17 29h15M17 36h10"/></>
      : <><path d="m24 3 20 10v24L24 46 4 37V13Zm0 19v24M4 13l20 9 20-9"/></>}
  </svg>;
}

export default function LessonAnimation({ plan }: { plan: LessonStoryboard }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  useEffect(() => {
    if (!playing || index >= plan.frames.length - 1) return;
    const timer = window.setTimeout(() => {
      if (document.hidden) { setPlaying(false); return; }
      setIndex(index + 1);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [index, playing, plan.frames.length]);
  const frame = plan.frames[index];
  return <section className={styles.animation} aria-label="Animated explanation" onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
    <div className={styles.stage} aria-hidden="true">
      {plan.actors.map(actor => {
        const state = frame.states.find(state => state.id === actor.id)!;
        const color = state.tone === 'bad' ? '#fb7185' : state.tone === 'good' ? '#34d399' : '#a99bff';
        return <div key={actor.id} data-actor={actor.id} className={styles.actor} style={{ left: `clamp(42px, ${state.x}%, calc(100% - 42px))`, top: `clamp(20px, ${state.y}%, calc(100% - 80px))`, opacity: state.visible ? 1 : 0, color, transform: actor.shape === 'bar' ? 'translateY(-100%)' : undefined }}>
          {actor.shape === 'bar' ? <div className={styles.bar} style={{ height: 25 * state.amount }} /> : <ActorGlyph shape={actor.shape} />}
          <span>{actor.label}</span>
          {actor.shape !== 'bar' && state.amount > 1 && <div className={styles.quantity}>{Array.from({ length: state.amount }, (_, i) => <i key={i} />)}</div>}
        </div>;
      })}
    </div>
    <p className={styles.narration} aria-live={playing ? 'off' : 'polite'}>{frame.narration}</p>
    <div className={styles.controls}>
      <button type="button" disabled={index === 0} onClick={() => { setPlaying(false); setIndex(index - 1); }}>Back</button>
      <button type="button" onClick={() => { if (index === plan.frames.length - 1) setIndex(0); setPlaying(!playing || index === plan.frames.length - 1); }}>{index === plan.frames.length - 1 ? 'Replay' : playing ? 'Pause' : 'Play'}</button>
      <button type="button" disabled={index === plan.frames.length - 1} onClick={() => { setPlaying(false); setIndex(index + 1); }}>Next</button>
      <small>{index + 1} / {plan.frames.length}</small>
    </div>
  </section>;
}
