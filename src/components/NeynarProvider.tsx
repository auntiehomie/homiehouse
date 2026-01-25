'use client';

import { NeynarContextProvider, Theme } from "@neynar/react";
import "@neynar/react/dist/style.css";
import { useEffect, useState } from 'react';

export default function NeynarProvider({ children }: { children: React.ReactNode }) {
  const [showError, setShowError] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      setShowError(true);
      console.error(
        '❌ Missing NEXT_PUBLIC_NEYNAR_CLIENT_ID\n' +
        'Please add it to your .env.local file.\n' +
        'Get your Client ID at: https://dev.neynar.com/'
      );
    }
  }, [clientId]);

  if (!clientId) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        backgroundColor: '#000',
        color: '#fff'
      }}>
        <div style={{
          maxWidth: '600px',
          textAlign: 'center',
          padding: '40px',
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          border: '1px solid #333'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h1 style={{ fontSize: '24px', marginBottom: '16px', fontWeight: 'bold' }}>
            Configuration Required
          </h1>
          <p style={{ fontSize: '16px', marginBottom: '24px', opacity: 0.8 }}>
            Missing <code style={{ backgroundColor: '#333', padding: '2px 8px', borderRadius: '4px' }}>NEXT_PUBLIC_NEYNAR_CLIENT_ID</code>
          </p>
          <div style={{ textAlign: 'left', backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '8px', fontSize: '14px' }}>
            <p style={{ marginBottom: '12px', fontWeight: 'bold' }}>Setup Steps:</p>
            <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>Go to <a href="https://dev.neynar.com" target="_blank" rel="noopener" style={{ color: '#E87722' }}>dev.neynar.com</a></li>
              <li>Sign in with your Farcaster account</li>
              <li>Create a new app or select existing</li>
              <li>Copy your <strong>Client ID</strong></li>
              <li>Add to <code style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '3px' }}>.env.local</code>:</li>
            </ol>
            <pre style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: '#000',
              borderRadius: '6px',
              overflow: 'auto',
              fontSize: '12px'
            }}>
              NEXT_PUBLIC_NEYNAR_CLIENT_ID=your_client_id_here
            </pre>
            <p style={{ marginTop: '12px', fontSize: '12px', opacity: 0.6 }}>
              Then restart your development server
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <NeynarContextProvider
      settings={{
        clientId,
        defaultTheme: Theme.Dark,
      }}
    >
      {children}
    </NeynarContextProvider>
  );
}
