'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { ReactNode } from 'react';
import { privyConfig } from '@/config/web3';

export default function PrivyAuthProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider {...privyConfig}>
      {children}
    </PrivyProvider>
  );
}
