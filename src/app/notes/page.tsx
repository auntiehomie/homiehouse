'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import SidebarNav from '@/components/SidebarNav';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const LS_KEY = 'hh_notes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString();
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

// ─── NoteForm ─────────────────────────────────────────────────────────────────

interface NoteFormProps {
  initial?: Note;
  onSave: (data: { title: string; content: string; tags: string[] }) => void;
  onCancel: () => void;
}

function NoteForm({ initial, onSave, onCancel }: NoteFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [tagInput, setTagInput] = useState(initial?.tags.join(', ') ?? '');

  const canSave = content.trim().length > 0;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '18px 20px',
      marginBottom: 20,
    }}>
      <input
        type="text"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: 9,
          border: '1px solid var(--border)',
          background: 'var(--bg-dark)',
          color: 'var(--text-on-dark)',
          fontSize: 15,
          fontWeight: 600,
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          marginBottom: 10,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      />
      <textarea
        placeholder="What's on your mind? Capture a thought, insight, or idea..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 9,
          border: '1px solid var(--border)',
          background: 'var(--bg-dark)',
          color: 'var(--text-on-dark)',
          fontSize: 14,
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          marginBottom: 10,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      />
      <input
        type="text"
        placeholder="Tags — e.g. defi, wallet, ideas"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: 9,
          border: '1px solid var(--border)',
          background: 'var(--bg-dark)',
          color: 'var(--text-on-dark)',
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          marginBottom: 14,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onSave({ title: title.trim(), content: content.trim(), tags: parseTags(tagInput) })}
          disabled={!canSave}
          style={{
            padding: '9px 20px',
            borderRadius: 9,
            border: 'none',
            background: canSave ? 'var(--btn-primary-bg)' : 'var(--surface)',
            color: canSave ? 'var(--btn-primary-color)' : 'var(--muted-on-dark)',
            fontSize: 14,
            fontWeight: 600,
            cursor: canSave ? 'pointer' : 'not-allowed',
            opacity: canSave ? 1 : 0.5,
            transition: 'all 0.15s',
          }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '9px 18px',
            borderRadius: 9,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--muted-on-dark)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onShare: (note: Note) => void;
}

function NoteCard({ note, onEdit, onDelete, onShare }: NoteCardProps) {
  const [deleteStep, setDeleteStep] = useState<0 | 1>(0);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteClick = () => {
    if (deleteStep === 0) {
      setDeleteStep(1);
      deleteTimerRef.current = setTimeout(() => setDeleteStep(0), 2000);
    } else {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      onDelete(note.id);
    }
  };

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '16px 18px',
        position: 'relative',
        transition: 'border-color 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
      onClick={() => onEdit(note)}
    >
      {/* Top-right actions */}
      <div
        style={{ position: 'absolute', top: 12, right: 14, display: 'flex', gap: 6 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Share */}
        <button
          onClick={() => onShare(note)}
          title="Share to Farcaster"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--muted-on-dark)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-on-dark)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted-on-dark)'; }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>

        {/* Delete */}
        <button
          onClick={handleDeleteClick}
          title={deleteStep === 1 ? 'Tap again to delete' : 'Delete note'}
          style={{
            height: 28,
            padding: '0 8px',
            borderRadius: 7,
            border: `1px solid ${deleteStep === 1 ? 'rgba(239,68,68,0.6)' : 'var(--border)'}`,
            background: deleteStep === 1 ? 'rgba(239,68,68,0.12)' : 'transparent',
            color: deleteStep === 1 ? '#f87171' : 'var(--muted-on-dark)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: deleteStep === 1 ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          {deleteStep === 1 ? (
            'Tap again to delete'
          ) : (
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Title */}
      {note.title && (
        <p style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-on-dark)',
          margin: '0 0 6px',
          paddingRight: 100,
          lineHeight: 1.4,
        }}>
          {note.title}
        </p>
      )}

      {/* Content preview — 3-line clamp */}
      <p style={{
        fontSize: 14,
        color: 'var(--muted-on-dark)',
        margin: '0 0 10px',
        lineHeight: 1.6,
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        paddingRight: note.title ? 0 : 100,
      }}>
        {note.content}
      </p>

      {/* Tags + time */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        {note.tags.map((tag) => (
          <span key={tag} style={{
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: 20,
            border: '1px solid var(--border)',
            color: 'var(--muted-on-dark)',
            background: 'var(--bg-dark)',
          }}>
            #{tag}
          </span>
        ))}
        <span style={{ fontSize: 11, color: 'var(--muted-on-dark)', marginLeft: note.tags.length ? 4 : 0 }}>
          {relativeTime(note.updatedAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '80px 20px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted-on-dark)',
      }}>
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-on-dark)', margin: '0 0 6px' }}>
          No notes yet
        </p>
        <p style={{ fontSize: 14, color: 'var(--muted-on-dark)', margin: 0, lineHeight: 1.6 }}>
          Your knowledge hub is empty. Start capturing ideas and insights about the decentralized web.
        </p>
      </div>
      <button
        onClick={onAdd}
        style={{
          padding: '10px 22px',
          borderRadius: 10,
          border: 'none',
          background: 'var(--btn-primary-bg)',
          color: 'var(--btn-primary-color)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        Capture your first insight
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        setNotes(JSON.parse(raw) as Note[]);
      }
    } catch { /* ignore */ }
    setMounted(true);
  }, []);

  // Persist on every change
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(notes));
    } catch { /* ignore */ }
  }, [notes, mounted]);

  const handleAdd = useCallback((data: { title: string; content: string; tags: string[] }) => {
    const now = new Date().toISOString();
    const note: Note = {
      id: newId(),
      title: data.title,
      content: data.content,
      tags: data.tags,
      createdAt: now,
      updatedAt: now,
    };
    setNotes((prev) => [note, ...prev]);
    setShowForm(false);
  }, []);

  const handleEdit = useCallback((data: { title: string; content: string; tags: string[] }) => {
    if (!editingNote) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === editingNote.id
          ? { ...n, title: data.title, content: data.content, tags: data.tags, updatedAt: new Date().toISOString() }
          : n
      )
    );
    setEditingNote(null);
  }, [editingNote]);

  const handleDelete = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (editingNote?.id === id) setEditingNote(null);
  }, [editingNote]);

  const handleShare = useCallback((note: Note) => {
    window.dispatchEvent(
      new CustomEvent('openComposeModal', {
        detail: { text: `📝 ${note.title || 'Note'}\n\n${note.content}` },
      })
    );
  }, []);

  const openEditForm = (note: Note) => {
    setShowForm(false);
    setEditingNote(note);
  };

  const openAddForm = () => {
    setEditingNote(null);
    setShowForm(true);
  };

  // All unique tags across all notes
  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags))).sort();

  // Filtered notes
  const filteredNotes = notes.filter((n) => {
    const matchesTag = activeTag === null || n.tags.includes(activeTag);
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      q === '' ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q);
    return matchesTag && matchesSearch;
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-dark)', color: 'var(--text-on-dark)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-on-dark)' }}>
            Knowledge Hub
          </h1>
          <p style={{ fontSize: 12, color: 'var(--muted-on-dark)', margin: '2px 0 0' }}>
            Capture notes, ideas, and insights
          </p>
        </div>
        <button
          onClick={openAddForm}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 16px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-color)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Note
        </button>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar — desktop only */}
        <aside
          className="hidden lg:block shrink-0"
          style={{
            width: 220,
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            padding: '16px 0',
          }}
        >
          <SidebarNav />
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>

            {/* Add Note inline form */}
            {showForm && (
              <NoteForm
                onSave={handleAdd}
                onCancel={() => setShowForm(false)}
              />
            )}

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <span style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted-on-dark)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
              }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-on-dark)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
            </div>

            {/* Tag filters */}
            {allTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                {/* All pill */}
                <button
                  onClick={() => setActiveTag(null)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 20,
                    border: `1px solid ${activeTag === null ? 'var(--accent)' : 'var(--border)'}`,
                    background: activeTag === null ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: activeTag === null ? 'var(--text-on-dark)' : 'var(--muted-on-dark)',
                    fontSize: 12,
                    fontWeight: activeTag === null ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 20,
                      border: `1px solid ${activeTag === tag ? 'var(--accent)' : 'var(--border)'}`,
                      background: activeTag === tag ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: activeTag === tag ? 'var(--text-on-dark)' : 'var(--muted-on-dark)',
                      fontSize: 12,
                      fontWeight: activeTag === tag ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            {/* Note list */}
            {mounted && notes.length === 0 && !showForm ? (
              <EmptyState onAdd={openAddForm} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredNotes.map((note) =>
                  editingNote?.id === note.id ? (
                    <NoteForm
                      key={note.id}
                      initial={note}
                      onSave={handleEdit}
                      onCancel={() => setEditingNote(null)}
                    />
                  ) : (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onEdit={openEditForm}
                      onDelete={handleDelete}
                      onShare={handleShare}
                    />
                  )
                )}
                {mounted && filteredNotes.length === 0 && notes.length > 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted-on-dark)', fontSize: 14 }}>
                    No notes match your search{activeTag ? ` in #${activeTag}` : ''}.
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
