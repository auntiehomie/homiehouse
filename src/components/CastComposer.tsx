'use client';

/**
 * CastComposer — a reusable Draft.js rich-text cast editor.
 *
 * Features:
 * - @mention autocomplete (via Hypersnap user search)
 * - Emoji picker
 * - URL auto-linking
 * - Channel selector dropdown
 * - Image upload
 * - Character count (320 for regular, switches to LONG_CAST above)
 * - Schedule toggle (date/time picker)
 * - Submit via useFarcasterWrites().submitCast
 *
 * Accepts optional `onSubmitted` callback and `defaultChannel`.
 */

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react';
import {
  EditorState,
  ContentState,
  convertToRaw,
  type DraftHandleValue,
} from 'draft-js';
import Editor from '@draft-js-plugins/editor';
import 'draft-js/dist/Draft.css';
import createEmojiPlugin from '@draft-js-plugins/emoji';
import createMentionPlugin, {
  defaultSuggestionsFilter,
  type MentionData,
} from '@draft-js-plugins/mention';
import createLinkifyPlugin from '@draft-js-plugins/linkify';
import { useFarcasterWrites } from '@/hooks/useFarcasterWrites';
import { useFarcasterAuth } from '@/lib/farcaster-auth';
import { searchUsers } from '@/lib/hypersnap';

// ─── Styles ─────────────────────────────────────────────────────────────────

const editorStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    width: '100%',
  },
  editor: {
    minHeight: '120px',
    maxHeight: '320px',
    overflowY: 'auto',
    padding: '12px',
    fontSize: '16px',
    lineHeight: '1.6',
    border: '1px solid var(--border, #e0e0e0)',
    borderRadius: '12px',
    background: 'var(--surface, #fff)',
    color: 'var(--text-on-dark, #111)',
    outline: 'none',
    cursor: 'text',
    transition: 'border-color 0.2s',
  },
  editorFocused: {
    borderColor: 'var(--accent, #7c3aed)',
    boxShadow: '0 0 0 2px rgba(124, 58, 237, 0.15)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 4px',
    flexWrap: 'wrap',
  },
  iconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: 'var(--muted, #666)',
    cursor: 'pointer',
    fontSize: '18px',
    transition: 'background 0.15s, color 0.15s',
  },
  submitBtn: {
    marginLeft: 'auto',
    padding: '8px 20px',
    border: 'none',
    borderRadius: '20px',
    background: 'var(--accent, #7c3aed)',
    color: '#fff',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  charCount: {
    fontSize: '12px',
    color: 'var(--muted, #999)',
    paddingRight: '8px',
  },
  charCountOver: {
    fontSize: '12px',
    color: '#ef4444',
    paddingRight: '8px',
    fontWeight: 600,
  },
  channelBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 12px',
    borderRadius: '16px',
    background: 'var(--accent, #7c3aed)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 500,
  },
  mentionsPopover: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    zIndex: 50,
    background: 'var(--surface, #fff)',
    border: '1px solid var(--border, #e0e0e0)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    overflow: 'hidden',
    maxHeight: '260px',
    overflowY: 'auto',
  },
  mentionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border, #f0f0f0)',
    transition: 'background 0.1s',
  },
  mentionItemActive: {
    background: 'var(--accent-light, rgba(124, 58, 237, 0.08))',
  },
  mentionAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  mentionName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-on-dark, #111)',
  },
  mentionUsername: {
    fontSize: '12px',
    color: 'var(--muted, #999)',
  },
  channelSelect: {
    padding: '6px 12px',
    border: '1px solid var(--border, #e0e0e0)',
    borderRadius: '8px',
    background: 'var(--surface, #fff)',
    color: 'var(--text-on-dark, #111)',
    fontSize: '13px',
    maxWidth: '160px',
  },
  imagePreview: {
    position: 'relative',
    display: 'inline-block',
    marginTop: '8px',
  },
  imagePreviewImg: {
    maxWidth: '200px',
    maxHeight: '200px',
    borderRadius: '8px',
    objectFit: 'cover',
    border: '1px solid var(--border, #e0e0e0)',
  },
  removeImgBtn: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: '1px solid var(--border, #e0e0e0)',
    background: 'var(--surface, #fff)',
    color: '#ef4444',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  },
};

// ─── Plugin instantiation ───────────────────────────────────────────────────

const emojiPlugin = createEmojiPlugin();
const mentionPlugin = createMentionPlugin({
  mentionPrefix: '@',
  mentionTrigger: '@',
  supportWhitespace: false,
});
const linkifyPlugin = createLinkifyPlugin({
  target: '_blank',
});

const { EmojiSelect } = emojiPlugin;
const { MentionSuggestions } = mentionPlugin;

const plugins = [emojiPlugin, mentionPlugin, linkifyPlugin];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPlainText(editorState: EditorState): string {
  return editorState.getCurrentContent().getPlainText();
}

function editorStateLength(editorState: EditorState): number {
  try {
    const raw = convertToRaw(editorState.getCurrentContent());
    let total = 0;
    for (const block of raw.blocks) {
      total += block.text.length;
    }
    return total;
  } catch {
    return getPlainText(editorState).length;
  }
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface CastComposerProps {
  /** Called after a successful cast submission. */
  onSubmitted?: (result: { castHash: string }) => void;
  /** Pre-select a channel (e.g. from the current channel page). */
  defaultChannel?: string;
  /** Pre-populate text (e.g. from a quote/share). */
  defaultText?: string;
  /** Called when the editor text changes. */
  onDraftChange?: (text: string) => void;
  /** External class name for the wrapper. */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CastComposer({
  onSubmitted,
  defaultChannel,
  defaultText,
  onDraftChange,
  className,
}: CastComposerProps) {
  const { fid: userFid } = useFarcasterAuth();
  const { hasActiveSigner, requestSigner, submitCast } = useFarcasterWrites();

  // ── Editor state ──────────────────────────────────────────────────────
  const [editorState, setEditorState] = useState<EditorState>(() => {
    const content = ContentState.createFromText(defaultText || '');
    return EditorState.createWithContent(content);
  });
  const editorRef = useRef<any>(null);

  // ── Mention state ─────────────────────────────────────────────────────
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionData[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearching, setMentionSearching] = useState(false);
  const mentionSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Compose UI state ──────────────────────────────────────────────────
  const [selectedChannel, setSelectedChannel] = useState(defaultChannel || '');
  const [channels, setChannels] = useState<{ id: string; name?: string }[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editorFocused, setEditorFocused] = useState(false);

  // ── Character count ───────────────────────────────────────────────────
  const charCount = useMemo(
    () => editorStateLength(editorState),
    [editorState],
  );
  const charLimit = 320;
  const isLongCast = charCount > charLimit;

  // ── Load channels ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!userFid) return;
    (async () => {
      try {
        const res = await fetch(`/api/channels?fid=${userFid}&limit=20`);
        const data = await res.json();
        if (data?.channels) {
          const clean = data.channels
            .filter((ch: any) => ch.id && !ch.id.includes(':') && !ch.id.includes('/'))
            .slice(0, 20);
          setChannels(clean.length ? clean : data.channels.slice(0, 20));
        }
      } catch {
        setChannels([
          { id: 'farcaster', name: 'Farcaster' },
          { id: 'base', name: 'Base' },
          { id: 'dev', name: 'Dev' },
          { id: 'art', name: 'Art' },
          { id: 'music', name: 'Music' },
        ]);
      }
    })();
  }, [userFid]);

  // ── Draft change callback ─────────────────────────────────────────────
  const onChange = useCallback(
    (state: EditorState) => {
      setEditorState(state);
      if (onDraftChange) {
        onDraftChange(getPlainText(state));
      }
    },
    [onDraftChange],
  );

  // ── Mention search ────────────────────────────────────────────────────
  const onMentionSearchChange = useCallback(
    ({ value }: { value: string; trigger: string }) => {
      if (value.length < 2) {
        setMentionSuggestions([]);
        return;
      }

      if (mentionSearchTimeout.current) {
        clearTimeout(mentionSearchTimeout.current);
      }

      mentionSearchTimeout.current = setTimeout(async () => {
        setMentionSearching(true);
        try {
          const data = await searchUsers(value, 8);
          const users: any[] = data?.users ?? [];
          const mapped: MentionData[] = users.map((u: any) => ({
            name: u.username || '',
            link: u.profile_url || `https://warpcast.com/${u.username || ''}`,
            avatar: u.pfp_url || '',
            id: u.fid,
            displayName: u.display_name || '',
          }));
          setMentionSuggestions(
            defaultSuggestionsFilter(value, mapped) as MentionData[],
          );
        } catch {
          setMentionSuggestions([]);
        } finally {
          setMentionSearching(false);
        }
      }, 250);
    },
    [],
  );

  // ── Mention open/close ────────────────────────────────────────────────
  const onMentionOpenChange = useCallback((open: boolean) => {
    setMentionOpen(open);
  }, []);

  // ── Handle return key ─────────────────────────────────────────────────
  const handleReturn = useCallback((): DraftHandleValue => {
    // Don't let Enter submit the cast — the submit button calls submit
    return 'not-handled';
  }, []);

  // ── Image upload ──────────────────────────────────────────────────────
  const handleImageUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploadingImage(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: form,
        });
        const data = await res.json();
        if (data?.url) {
          setImageUrls((prev) => [...prev, data.url]);
        }
      } catch (err) {
        console.error('Image upload failed:', err);
      } finally {
        setUploadingImage(false);
      }
    };
    input.click();
  }, []);

  const removeImage = useCallback((url: string) => {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const text = getPlainText(editorState).trim();
    if (!text) return;

    if (!hasActiveSigner) {
      await requestSigner();
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      const embeds = imageUrls.length
        ? imageUrls.map((url) => ({ url }))
        : undefined;

      const result = await submitCast({
        text,
        embeds,
        channelKey: selectedChannel || undefined,
      });

      // Clear editor on success
      setEditorState(
        EditorState.createWithContent(ContentState.createFromText('')),
      );
      setImageUrls([]);
      setStatus('Cast sent!');

      if (onSubmitted) {
        onSubmitted(result);
      }
    } catch (err: any) {
      setStatus(err?.message || 'Failed to send cast');
    } finally {
      setSubmitting(false);
    }
  }, [
    editorState,
    hasActiveSigner,
    requestSigner,
    submitCast,
    imageUrls,
    selectedChannel,
    onSubmitted,
  ]);

  // ── Schedule ──────────────────────────────────────────────────────────
  const toggleSchedule = useCallback(() => {
    setIsScheduled((prev) => !prev);
    if (isScheduled) setScheduleTime('');
  }, [isScheduled]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      className={className}
      style={{ ...editorStyles.wrapper, width: '100%' }}
    >
      {/* Channel + schedule row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selectedChannel}
          onChange={(e) => setSelectedChannel(e.target.value)}
          style={editorStyles.channelSelect}
          aria-label="Select channel"
        >
          <option value="">No channel</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              /{ch.id}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={toggleSchedule}
          style={{
            ...editorStyles.iconBtn,
            color: isScheduled ? 'var(--accent, #7c3aed)' : undefined,
            fontSize: '13px',
            width: 'auto',
            padding: '4px 10px',
            gap: '4px',
          }}
          title="Schedule for later"
        >
          🕐 {isScheduled ? 'Scheduled' : 'Schedule'}
        </button>

        {isScheduled && (
          <input
            type="datetime-local"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--border, #e0e0e0)',
              borderRadius: '8px',
              fontSize: '13px',
              background: 'var(--surface, #fff)',
              color: 'var(--text-on-dark, #111)',
            }}
          />
        )}
      </div>

      {/* Draft.js Editor */}
      <div
        style={{
          ...editorStyles.editor,
          ...(editorFocused ? editorStyles.editorFocused : {}),
        }}
        onClick={() => editorRef.current?.focus?.()}
      >
        <Editor
          editorState={editorState}
          onChange={onChange}
          plugins={plugins}
          ref={editorRef}
          onFocus={() => setEditorFocused(true)}
          onBlur={() => setEditorFocused(false)}
          handleReturn={handleReturn}
          placeholder="What's happening?"
        />

        {/* Mention suggestions popover */}
        <MentionSuggestions
          open={mentionOpen}
          onOpenChange={onMentionOpenChange}
          onSearchChange={onMentionSearchChange}
          suggestions={mentionSuggestions}
          onAddMention={() => {
            // The plugin handles insertion internally via addMention
          }}
          entryComponent={MentionEntry}
        />
      </div>

      {/* Image previews */}
      {imageUrls.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
          {imageUrls.map((url) => (
            <div key={url} style={editorStyles.imagePreview}>
              <img
                src={url}
                alt="Upload preview"
                style={editorStyles.imagePreviewImg}
              />
              <button
                type="button"
                onClick={() => removeImage(url)}
                style={editorStyles.removeImgBtn}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={editorStyles.toolbar}>
        {/* Emoji picker */}
        <EmojiSelect />

        {/* Image upload */}
        <button
          type="button"
          onClick={handleImageUpload}
          style={editorStyles.iconBtn}
          disabled={uploadingImage}
          title="Add image"
        >
          {uploadingImage ? '⏳' : '🖼️'}
        </button>

        {/* Character count */}
        <span
          style={charCount > charLimit ? editorStyles.charCountOver : editorStyles.charCount}
        >
          {charCount} / {charLimit}
          {isLongCast && ' (long cast)'}
        </span>

        {/* Status */}
        {status && (
          <span
            style={{
              fontSize: '12px',
              color: status.includes('Failed') || status.includes('error') ? '#ef4444' : '#22c55e',
            }}
          >
            {status}
          </span>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || charCount === 0}
          style={{
            ...editorStyles.submitBtn,
            opacity: submitting || charCount === 0 ? 0.5 : 1,
          }}
        >
          {submitting ? 'Sending…' : 'Cast'}
        </button>
      </div>
    </div>
  );
}

// ── Mention entry component ─────────────────────────────────────────────────

interface MentionEntryProps {
  mention: MentionData;
  isFocused: boolean;
  searchValue?: string;
  theme?: any;
  selectMention: (mention: MentionData) => void;
  id?: string;
}

function MentionEntry({
  mention,
  isFocused,
  selectMention,
}: MentionEntryProps) {
  return (
    <div
      role="option"
      aria-selected={isFocused}
      style={{
        ...editorStyles.mentionItem,
        ...(isFocused ? editorStyles.mentionItemActive : {}),
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        selectMention(mention);
      }}
    >
      {mention.avatar ? (
        <img
          src={mention.avatar}
          alt={mention.name}
          style={editorStyles.mentionAvatar}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          style={{
            ...editorStyles.mentionAvatar,
            background: 'var(--border, #e0e0e0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: '#999',
          }}
        >
          {mention.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <div style={editorStyles.mentionName}>
          {(mention as any).displayName || mention.name}
        </div>
        <div style={editorStyles.mentionUsername}>@{mention.name}</div>
      </div>
    </div>
  );
}