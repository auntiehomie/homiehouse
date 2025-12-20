import React from 'react';

type Props = {
  open: boolean;
  title?: string;
  children?: React.ReactNode;
  onClose: () => void;
  onPrimary?: () => void;
  primaryLabel?: string;
};

export default function FallbackModal({ open, title = 'Fallback', children, onClose, onPrimary, primaryLabel = 'Open' }: Props) {
  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal-header">
          <h3>{title}</h3>
        </header>
        <div className="modal-body">{children}</div>
        <footer className="modal-footer">
          {onPrimary && (
            <button
              className="btn primary"
              onClick={async () => {
                try {
                  await onPrimary();
                } finally {
                  onClose();
                }
              }}
            >
              {primaryLabel}
            </button>
          )}
          <button className="btn" onClick={onClose} style={{ marginLeft: 8 }}>
            Dismiss
          </button>
        </footer>
      </div>
    </div>
  );
}
