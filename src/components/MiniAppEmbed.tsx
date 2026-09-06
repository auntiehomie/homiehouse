'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  createMiniAppHost,
  type MiniAppHostHandle,
} from '@/lib/miniapp';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MiniAppEmbedProps {
  /** URL of the Farcaster Snap / Mini App to embed. */
  snapUrl: string;

  /** Optional CSS class name for the container. */
  className?: string;

  /** Optional title for the iframe (accessibility). */
  title?: string;

  /** Optional host config overrides. */
  hostConfig?: Parameters<typeof createMiniAppHost>[0];

  /** Callback when the iframe loads successfully. */
  onLoad?: () => void;

  /** Callback when the iframe fails to load. */
  onError?: (error: string) => void;

  /**
   * Expose host handle so parent components can send frame actions.
   * Useful for triggering frame actions from outside the iframe.
   */
  hostRef?: React.MutableRefObject<MiniAppHostHandle | null>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MiniAppEmbed({
  snapUrl,
  className,
  title = 'Farcaster Mini App',
  hostConfig,
  onLoad,
  onError,
  hostRef,
}: MiniAppEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hostHandleRef = useRef<MiniAppHostHandle | null>(null);

  // ------------------------------------------------------------------
  // Initialise the host and mount the mini app
  // ------------------------------------------------------------------
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Prevent re-mounting an already mounted iframe.
    if (hostHandleRef.current) return;

    setStatus('loading');

    try {
      const host = createMiniAppHost(hostConfig);
      hostHandleRef.current = host;

      if (hostRef) {
        hostRef.current = host;
      }

      host.mountMiniApp(iframe, snapUrl);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unknown host mount error';
      setErrorMessage(msg);
      setStatus('error');
      onError?.(msg);
    }

    return () => {
      hostHandleRef.current = null;
      if (hostRef) {
        hostRef.current = null;
      }
    };
    // We intentionally only run this on mount / snapUrl change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapUrl]);

  // ------------------------------------------------------------------
  // Iframe event handlers
  // ------------------------------------------------------------------
  const handleIframeLoad = useCallback(() => {
    setStatus('ready');
    onLoad?.();
  }, [onLoad]);

  const handleIframeError = useCallback(() => {
    const msg = 'Mini App iframe failed to load';
    setErrorMessage(msg);
    setStatus('error');
    onError?.(msg);
  }, [onError]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div
      className={`miniapp-embed${className ? ` ${className}` : ''}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* Loading overlay */}
      {status === 'loading' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.9)',
            zIndex: 1,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 14,
            color: '#666',
          }}
        >
          Loading Mini App&hellip;
        </div>
      )}

      {/* Error display */}
      {status === 'error' && errorMessage && (
        <div
          style={{
            padding: 16,
            background: '#fff0f0',
            border: '1px solid #e0b0b0',
            borderRadius: 8,
            fontFamily: 'system-ui, sans-serif',
            fontSize: 14,
          }}
        >
          <strong>Failed to load Mini App</strong>
          <p style={{ margin: '4px 0 0', color: '#c00' }}>{errorMessage}</p>
        </div>
      )}

      {/* Iframe */}
      {status !== 'error' && (
        <iframe
          ref={iframeRef}
          src={snapUrl}
          title={title}
          sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-presentation allow-downloads"
          allow="camera; microphone; clipboard-write"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          style={{
            border: 'none',
            width: '100%',
            height: '100%',
            minHeight: 400,
            visibility: status === 'loading' ? 'hidden' : 'visible',
          }}
        />
      )}
    </div>
  );
}
