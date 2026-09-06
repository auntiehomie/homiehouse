'use client';

import { useRef, useState, useCallback } from 'react';
import { uploadVideo } from '@/lib/video-upload';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VideoUploaderProps {
  /** Called with the final uploaded URL on success. */
  onUploaded?: (url: string) => void;

  /** Called when the upload fails. */
  onError?: (error: Error) => void;

  /** tus-compatible upload endpoint. */
  endpoint?: string;

  /** Accepted MIME types (default: video/*). */
  accept?: string;

  /** Additional CSS class. */
  className?: string;

  /** Label text for the file input. */
  label?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VideoUploader({
  onUploaded,
  onError,
  endpoint,
  accept = 'video/*',
  className,
  label = 'Choose a video file',
}: VideoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset state.
      setError(null);
      setResultUrl(null);
      setUploading(true);
      setProgress(0);

      uploadVideo(file, {
        endpoint,
        onProgress: (uploaded, total) => {
          const pct = total > 0 ? Math.round((uploaded / total) * 100) : 0;
          setProgress(pct);
        },
        onError: (err) => {
          setUploading(false);
          setError(err.message);
          onError?.(err);
        },
      })
        .then((url) => {
          setUploading(false);
          setProgress(100);
          setResultUrl(url);
          onUploaded?.(url);
        })
        .catch((err: Error) => {
          setUploading(false);
          setError(err.message);
          onError?.(err);
        });
    },
    [endpoint, onError, onUploaded],
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setProgress(null);
    setResultUrl(null);
    fileInputRef.current?.click();
  }, []);

  const handleReset = useCallback(() => {
    setError(null);
    setProgress(null);
    setResultUrl(null);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div
      className={`video-uploader${className ? ` ${className}` : ''}`}
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 480,
        width: '100%',
      }}
    >
      {/* Success state */}
      {resultUrl && !uploading && (
        <div
          style={{
            padding: 12,
            background: '#dff0d8',
            border: '1px solid #b0d0a0',
            borderRadius: 8,
            fontSize: 14,
            wordBreak: 'break-all',
          }}
        >
          <strong>Upload complete!</strong>
          <p
            style={{
              margin: '6px 0 0',
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          >
            {resultUrl}
          </p>
          <button
            type="button"
            onClick={handleReset}
            style={{ marginTop: 8, cursor: 'pointer' }}
          >
            Upload another
          </button>
        </div>
      )}

      {/* Error state */}
      {error && !uploading && (
        <div
          style={{
            padding: 12,
            background: '#fdd',
            border: '1px solid #ecc',
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <strong>Upload failed</strong>
          <p style={{ margin: '4px 0 0', color: '#c00' }}>{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            style={{ marginTop: 8, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Upload form */}
      {!uploading && !resultUrl && (
        <div style={{ marginBottom: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={uploading}
            style={{ display: 'block', fontSize: 14 }}
          />
          <p
            style={{
              display: 'block',
              marginTop: 4,
              fontSize: 12,
              color: '#888',
            }}
          >
            {label}
          </p>
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              height: 8,
              background: '#eee',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress ?? 0}%`,
                background: '#4caf50',
                transition: 'width 0.3s ease',
                borderRadius: 4,
              }}
            />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#666' }}>
            Uploading&hellip; {progress ?? 0}%
          </p>
        </div>
      )}
    </div>
  );
}
