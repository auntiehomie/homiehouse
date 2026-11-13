'use client';

import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react';
import type { Tiktoken } from 'js-tiktoken/lite';

const defaultSample = 'Hello, Homie!';
const steps = ['Text', 'Tokens', 'IDs'] as const;
let tokenizerPromise: Promise<Tiktoken> | undefined;

function loadTokenizer() {
  tokenizerPromise ??= Promise.all([
    import('js-tiktoken/lite'),
    import('js-tiktoken/ranks/cl100k_base'),
  ]).then(([{ Tiktoken }, { default: ranks }]) => new Tiktoken(ranks)).catch(error => {
    tokenizerPromise = undefined;
    throw error;
  });
  return tokenizerPromise;
}

export default function TokenizationScene({ sample = defaultSample }: { sample?: string }) {
  const inputId = useId();
  const [input, setInput] = useState(sample);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [tokenizer, setTokenizer] = useState<Tiktoken>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void loadTokenizer().then(value => {
      if (active) setTokenizer(value);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);

  const tokens = useMemo(() => tokenizer?.encode(input, [], []).map(id => ({
    id,
    text: tokenizer.decode([id]),
  })) ?? [], [tokenizer, input]);

  function changeInput(value: string) {
    setInput(value);
    setSelected(null);
  }

  return (
    <section className="hh-tokenizer" aria-label="Interactive tokenizer">
      <style>{`
        .hh-tokenizer {
          display: grid;
          min-width: 0;
          gap: 10px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface);
          color: var(--text-on-dark);
        }

        .hh-tokenizer input,
        .hh-tokenizer button {
          min-width: 0;
          min-height: 44px;
          max-width: 100%;
          padding: 7px 10px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: transparent;
          color: inherit;
          font: inherit;
        }

        .hh-tokenizer input { font-size: 16px; }
        .hh-tokenizer button { cursor: pointer; }
        .hh-tokenizer button[aria-pressed='true'] {
          border-color: var(--accent);
          background: rgba(52, 211, 153, .14);
        }
        .hh-tokenizer :is(input, button):focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .hh-tokenizer .controls,
        .hh-tokenizer .tokens {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .hh-tokenizer .caption { margin: 0; color: var(--muted-on-dark); font-size: 13px; }
        .hh-tokenizer .preview { white-space: pre-wrap; overflow-wrap: anywhere; }
        .hh-tokenizer .tokens { list-style: none; margin: 0; padding: 0; }
        .hh-tokenizer .tokens li {
          max-width: 100%;
          animation: hhTokenSplit 260ms ease-out var(--delay) both;
        }
        .hh-tokenizer .tokens button {
          display: grid;
          gap: 3px;
          overflow-wrap: anywhere;
          background: rgba(129, 118, 232, .18);
        }
        .hh-tokenizer .tokens li:nth-child(even) button:not([aria-pressed='true']) { background: rgba(52, 211, 153, .12); }
        .hh-tokenizer .tokenId {
          font-variant-numeric: tabular-nums;
          animation: hhTokenReveal 180ms ease-out both;
        }

        @keyframes hhTokenSplit {
          from { opacity: 0; transform: translateY(6px) scale(.94); }
        }
        @keyframes hhTokenReveal {
          from { opacity: 0; transform: translateY(-3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hh-tokenizer .tokens li,
          .hh-tokenizer .tokenId { animation: none; }
        }
      `}</style>
      <label htmlFor={inputId}>Text to tokenize</label>
      <input id={inputId} value={input} maxLength={48} onChange={event => changeInput(event.target.value)} />
      <div className="controls" role="group" aria-label="Tokenization steps">
        {steps.map((label, index) => (
          <button type="button" key={label} aria-pressed={step === index} onClick={() => {
            setStep(index);
            setSelected(null);
          }}>{label}</button>
        ))}
      </div>
      <p className="caption" role="status">
        {step === 0 ? 'Predict where the text will split, then tap Tokens.'
          : failed ? 'The tokenizer could not load. Reopen this step to try again.'
          : !tokenizer ? 'Loading the tokenizer…'
          : !tokens.length ? 'Enter some text to see its tokens.'
          : step === 1 ? `${tokens.length} ${tokens.length === 1 ? 'token' : 'tokens'}. Try adding a space or punctuation.`
          : 'Each number is a token’s ID in this tokenizer’s vocabulary.'}
      </p>
      {step === 0 && <div className="preview">{input}</div>}
      {step > 0 && tokens.length > 0 && (
        <ol className="tokens" aria-label={step === 1 ? 'Tokens in order' : 'Tokens and IDs in order'}>
          {tokens.map((token, index) => {
            const fragment = token.text.includes('\uFFFD') && tokenizer?.encode(token.text, [], [])[0] !== token.id;
            const visibleText = fragment ? 'UTF-8 fragment' : token.text.replace(/ /g, '␣').replace(/\t/g, '⇥');
            return (
              <li key={`${index}:${token.id}`} style={{ '--delay': `${Math.min(index, 9) * 24}ms` } as CSSProperties}>
                <button type="button" aria-pressed={selected === index} onClick={() => setSelected(selected === index ? null : index)}>
                  <code aria-label={fragment ? undefined : token.text.replace(/ /g, " space ").replace(/\t/g, " tab ")}>{visibleText}</code>
                  {step === 2 && <span className="tokenId">ID {token.id}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {step > 0 && tokens.length > 0 && <p className="caption">cl100k_base · ␣ marks a space</p>}
      {step > 0 && selected !== null && <p className="caption" role="status">Token {selected + 1} of {tokens.length} in the input sequence.</p>}
    </section>
  );
}
