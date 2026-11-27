'use client';

import StickerPicker from './StickerPicker';
import styles from './StickerPicker.module.css';
import { MAX_CAST_EMBEDS } from '@/lib/cast-embeds';

export default function ReplyStickers({ urls, onChange }: {
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  return (
    <div className={styles.attachments}>
      <StickerPicker
        disabled={urls.length >= MAX_CAST_EMBEDS}
        onSelect={sticker => {
          if (!urls.includes(sticker.url)) onChange([...urls, sticker.url]);
        }}
      />
      {urls.map((url, index) => (
        <div key={url} className={styles.attachment}>
          <img src={url} crossOrigin="anonymous" alt={`Selected sticker ${index + 1}`} width={60} height={60} />
          <button
            type="button"
            className={styles.remove}
            aria-label={`Remove sticker ${index + 1}`}
            onClick={() => onChange(urls.filter(selected => selected !== url))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
