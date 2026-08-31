'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** A label for Sentry scope tagging, e.g. "FeedPage" or "LearnModule" */
  label?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Lightweight error boundary that captures exceptions to Sentry (if available)
 * and renders a graceful fallback UI instead of a white screen.
 *
 * Usage:
 *   <SentryErrorBoundary label="Feed">
 *     <FeedClient />
 *   </SentryErrorBoundary>
 */
export default class SentryErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Lazily import Sentry so the app works even if @sentry/nextjs isn't initialised
    try {
      // @ts-ignore — dynamic import to avoid bundling Sentry in dev if not needed
      import('@sentry/nextjs').then((Sentry: any) => {
        if (Sentry?.captureException) {
          Sentry.captureException(error, {
            extra: { ...errorInfo, label: this.props.label },
            tags: { component: this.props.label ?? 'unknown' },
          });
        }
      });
    } catch {
      // Sentry not available — silent
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          color: 'var(--muted-on-dark, #888)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '8px 20px',
              borderRadius: 10,
              border: '1px solid var(--border, #333)',
              background: 'transparent',
              color: 'var(--accent, #6366f1)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
