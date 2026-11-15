'use client';

import { useState } from 'react';
import styles from './LessonActivity.module.css';

export function lessonActivityFor(text: string) {
  if (/sandbox(?:ing)?/i.test(text) && /validat|verif|permission|read.only/i.test(text)) return 'sandbox';
  if (/direct vs\.? indirect|indirect (?:prompt )?injection/i.test(text)) return 'source';
  if (/nonce/i.test(text) && /ethereum|transaction/i.test(text)) return 'nonce';
  return null;
}

type Activity = NonNullable<ReturnType<typeof lessonActivityFor>>;

export default function LessonActivity({ activity }: { activity: Activity }) {
  const [source, setSource] = useState<'message' | 'document'>();
  const [prediction, setPrediction] = useState<'allowed' | 'blocked'>();
  const [ran, setRan] = useState(false);
  const [queue, setQueue] = useState({ next: 8, waiting: false, message: '' });

  return (
    <section
      className={styles.activity}
      aria-label="Lesson activity"
      onTouchStart={event => event.stopPropagation()}
      onTouchEnd={event => event.stopPropagation()}
    >
      {activity === 'source' && <>
        <h3>Trace the input</h3>
        <p>Choose what the agent reads.</p>
        <div className={styles.controls}>
          <button type="button" aria-pressed={source === 'message'} onClick={() => setSource('message')}>User message</button>
          <button type="button" aria-pressed={source === 'document'} onClick={() => setSource('document')}>Retrieved document</button>
        </div>
        <div className={styles.feedback} role="status">
          {source === 'message' && <div key={source}>
            <p className={styles.route}>User message → Chat → Agent</p>
            <p>The agent knows who sent the message and checks the request against its permissions.</p>
          </div>}
          {source === 'document' && <div key={source}>
            <p className={styles.route}>External document → Retrieval tool → Agent</p>
            <p>Instruction-like text inside the document is untrusted data. The document cannot grant permission to act.</p>
          </div>}
        </div>
      </>}
      {activity === 'sandbox' && <>
        <h3>Try a read-only sandbox</h3>
        <p>A mock tool requests a write to a file it can only read. Predict the result, then run the simulation.</p>
        <div className={styles.controls}>
          <button type="button" aria-pressed={prediction === 'allowed'} onClick={() => { setPrediction('allowed'); setRan(false); }}>Write allowed</button>
          <button type="button" aria-pressed={prediction === 'blocked'} onClick={() => { setPrediction('blocked'); setRan(false); }}>Write blocked</button>
          <button type="button" disabled={!prediction || ran} onClick={() => setRan(true)}>Run simulation</button>
        </div>
        <div className={styles.feedback} role="status">
          {ran && <div>
            <p>{prediction === 'blocked' ? 'Correct. The write is blocked.' : 'The sandbox blocks the write.'}</p>
            <ol>
              <li>Validation accepts the request format.</li>
              <li>The sandbox denies the write because access is read-only.</li>
              <li>Verification checks that the file contents are unchanged.</li>
            </ol>
          </div>}
        </div>
      </>}
      {activity === 'nonce' && <>
        <h3>Order two transactions</h3>
        <p>This account expects nonce 8. Try submitting 9 first.</p>
        <div className={styles.controls}>
          <button type="button" disabled={queue.next > 8} onClick={() => setQueue({
            next: queue.waiting ? 10 : 9,
            waiting: false,
            message: queue.waiting ? '8 was included first, then 9 was included.' : '8 was included. 9 is now eligible.',
          })}>Submit 8</button>
          <button type="button" disabled={queue.waiting || queue.next > 9} onClick={() => setQueue(queue.next === 8
            ? { next: 8, waiting: true, message: '9 is queued in this simulation until 8 is included.' }
            : { next: 10, waiting: false, message: '9 was included. Both transactions are complete.' }
          )}>Submit 9</button>
          <button type="button" onClick={() => setQueue({ next: 8, waiting: false, message: '' })}>Reset</button>
        </div>
        <div className={styles.feedback} role="status">
          <div key={`${queue.next}-${queue.waiting}`}>
            <ul className={styles.queue}>
              <li>8 · {queue.next > 8 ? 'Included' : 'Expected'}</li>
              <li>9 · {queue.next > 9 ? 'Included' : queue.waiting ? 'Waiting for 8' : queue.next === 9 ? 'Eligible' : 'Unsubmitted'}</li>
            </ul>
            <p>{queue.message || 'The next nonce is 8.'}</p>
          </div>
        </div>
      </>}
    </section>
  );
}
