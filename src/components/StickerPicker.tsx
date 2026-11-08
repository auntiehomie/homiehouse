'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Sticker, StickerPack } from '@/lib/sticker-pack';
import styles from './StickerPicker.module.css';

type StickerPickerProps = {
  onSelect: (sticker: Sticker) => void;
  disabled?: boolean;
};

export default function StickerPicker({ onSelect, disabled = false }: StickerPickerProps) {
  const id = useId();
  const picker = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pack, setPack] = useState<StickerPack | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open || pack || error) return;

    const controller = new AbortController();
    fetch('/api/sticker-pack', { signal: controller.signal, credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) throw new Error('Sticker pack request failed');
        const stickerPack: StickerPack = await response.json();
        if (!controller.signal.aborted) setPack(stickerPack);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });

    return () => controller.abort();
  }, [open, pack, error]);

  const normalizedQuery = query.trim().toLowerCase();
  const stickers = pack?.stickers.filter(sticker =>
    `${sticker.name} ${sticker.tags.join(' ')}`.toLowerCase().includes(normalizedQuery)
  ) ?? [];

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Add sticker"
        aria-haspopup="dialog"
        title={disabled ? 'No attachment slots remaining' : 'Add sticker'}
        disabled={disabled}
        popoverTarget={id}
      >
        ✦ Stickers
      </button>
      <div
        id={id}
        ref={picker}
        popover="auto"
        role="dialog"
        aria-label="Choose a sticker"
        className={styles.popover}
        onToggle={event => {
          const isOpen = event.currentTarget.matches(':popover-open');
          setOpen(isOpen);
          if (isOpen) setError(false);
        }}
      >
        <div className={styles.header}>
          <strong>{pack?.name || 'Stickers'}</strong>
          <button type="button" aria-label="Close stickers" popoverTarget={id} popoverTargetAction="hide">
            ×
          </button>
        </div>
        <input
          className={styles.search}
          aria-label="Search stickers"
          placeholder="Search stickers"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        {!pack && !error && <p role="status">Loading stickers…</p>}
        {error && (
          <p role="alert">
            Stickers are unavailable right now. <button type="button" onClick={() => setError(false)}>Retry</button>
          </p>
        )}
        {pack && !stickers.length && <p>No matching stickers.</p>}
        <div className={styles.grid}>
          {stickers.map(sticker => (
            <button
              type="button"
              key={sticker.id}
              aria-label={`Add ${sticker.name} sticker`}
              onClick={() => {
                picker.current?.hidePopover();
                onSelect(sticker);
              }}
            >
              <img src={sticker.url} alt={sticker.alt} loading="lazy" crossOrigin="anonymous" referrerPolicy="no-referrer" />
              <span>{sticker.name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
