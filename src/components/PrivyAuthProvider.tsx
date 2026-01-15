'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { ReactNode } from 'react';

export default function PrivyAuthProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'cmkepp0up026ikw0cbge0prbi'}
      config={{
        loginMethods: ['farcaster', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#E87722',
          logo: 'https://homiehouse.vercel.app/logo.png',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        farcaster: {
          enabled: true,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
