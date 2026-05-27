'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PrivyProvider, usePrivy, useFarcasterSigner, useCreateWallet } from '@privy-io/react-auth';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { wagmiConfig, walletConnectConfig, privyConfig, chains } from '@/config/web3';
import { Web3Error } from '@/config/web3';

import '@rainbow-me/rainbowkit/styles.css';

// Authentication state interface
export interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  wallet: {
    address: string | null;
    chainId: number | null;
    provider: 'privy' | 'walletconnect' | 'rainbowkit' | null;
  };
  farcaster: {
    fid: number | null;
    signerUuid: string | null;
  };
  isConnecting: boolean;
  isLoading: boolean;
  error: Web3Error | null;
}

// Authentication context
interface AuthContextType extends AuthState {
  connectWallet: (provider?: 'privy' | 'walletconnect' | 'rainbowkit') => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  switchChain: (chainId: number) => Promise<void>;
  getFarcasterSigner: () => Promise<{ signerUuid: string; fid: number } | null>;
  farcasterSigner: {
    hasActiveSigner: boolean;
    requestSigner: () => Promise<void>;
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook to use authentication
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within UnifiedAuthProvider');
  }
  return context;
}

// Inner component that uses Privy hooks (must be inside PrivyProvider)
function AuthStateManager({ children }: { children: ReactNode }) {
  const { authenticated, user } = usePrivy();
  const { requestFarcasterSignerFromWarpcast, getFarcasterSignerPublicKey } = useFarcasterSigner();
  const { createWallet } = useCreateWallet();

  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    wallet: {
      address: null,
      chainId: null,
      provider: null,
    },
    farcaster: {
      fid: null,
      signerUuid: null,
    },
    isConnecting: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const savedAuth = localStorage.getItem('homiehouse_auth');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        setAuthState(prev => ({ ...prev, ...parsed, isLoading: false }));
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: new Web3Error('Failed to initialize authentication', 'AUTH_INIT_FAILED', error),
      }));
    }
  };

  const saveAuthState = (newState: Partial<AuthState>) => {
    const updatedState = { ...authState, ...newState };
    setAuthState(updatedState);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('homiehouse_auth', JSON.stringify({
          isAuthenticated: updatedState.isAuthenticated,
          user: updatedState.user,
          wallet: updatedState.wallet,
          farcaster: updatedState.farcaster,
        }));
      } catch (error) {
        console.warn('Failed to persist auth state:', error);
      }
    }
  };

  const connectWallet = async (provider: 'privy' | 'walletconnect' | 'rainbowkit' = 'privy') => {
    try {
      setAuthState(prev => ({ ...prev, isConnecting: true, error: null }));
      window.dispatchEvent(new CustomEvent('homiehouse:connect-wallet', { detail: { provider } }));
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isConnecting: false,
        error: new Web3Error('Failed to connect wallet', 'WALLET_CONNECTION_FAILED', error),
      }));
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      setAuthState(prev => ({ ...prev, isConnecting: true }));
      if (typeof window !== 'undefined') {
        localStorage.removeItem('homiehouse_auth');
      }
      setAuthState({
        isAuthenticated: false,
        user: null,
        wallet: { address: null, chainId: null, provider: null },
        farcaster: { fid: null, signerUuid: null },
        isConnecting: false,
        isLoading: false,
        error: null,
      });
      window.dispatchEvent(new CustomEvent('homiehouse:disconnect-wallet'));
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isConnecting: false,
        error: new Web3Error('Failed to disconnect', 'DISCONNECT_FAILED', error),
      }));
    }
  };

  const signMessage = async (message: string): Promise<string> => {
    if (!authState.isAuthenticated || !authState.wallet.address) {
      throw new Web3Error('Not authenticated', 'NOT_AUTHENTICATED');
    }
    return new Promise((resolve, reject) => {
      const handleSigned = (event: CustomEvent) => {
        window.removeEventListener('homiehouse:message-signed', handleSigned as EventListener);
        resolve(event.detail.signature);
      };
      const handleError = (event: CustomEvent) => {
        window.removeEventListener('homiehouse:sign-error', handleError as EventListener);
        reject(new Web3Error('Message signing failed', 'SIGN_FAILED', event.detail.error));
      };
      window.addEventListener('homiehouse:message-signed', handleSigned as EventListener);
      window.addEventListener('homiehouse:sign-error', handleError as EventListener);
      window.dispatchEvent(new CustomEvent('homiehouse:sign-message', { detail: { message } }));
    });
  };

  const switchChain = async (chainId: number) => {
    if (!authState.isAuthenticated) {
      throw new Web3Error('Not authenticated', 'NOT_AUTHENTICATED');
    }
    window.dispatchEvent(new CustomEvent('homiehouse:switch-chain', { detail: { chainId } }));
  };

  const getFarcasterSigner = async () => {
    if (!authenticated || !user) {
      console.log('User not authenticated with Privy');
      return null;
    }
    const farcasterAccount = user.linkedAccounts?.find((a: any) => a.type === 'farcaster') as any;
    if (!farcasterAccount) return null;
    return {
      signerUuid: farcasterAccount.signerPublicKey ?? '',
      fid: farcasterAccount.fid ?? 0,
    };
  };

  // Farcaster signer state derived from Privy user
  const farcasterAccount = user?.linkedAccounts?.find((a: any) => a.type === 'farcaster') as any;
  const hasActiveSigner = !!(farcasterAccount?.signerPublicKey && authenticated);

  const requestSigner = async () => {
    // Ensure an embedded wallet exists first (required by Privy for Farcaster signers)
    // Check both 'privy' (v1) and 'privy-v2' embedded wallet types.
    const embeddedWallet = user?.linkedAccounts?.find(
      (a: any) => a.type === 'wallet' &&
        (a.walletClientType === 'privy' || a.walletClientType === 'privy-v2')
    );
    if (!embeddedWallet) {
      try {
        await createWallet();
      } catch (e: any) {
        const code = e?.privyErrorCode ?? e?.code ?? '';
        const msg = e?.message?.toLowerCase() ?? '';
        if (code !== 'embedded_wallet_already_exists' && !msg.includes('already')) throw e;
      }
    }
    await requestFarcasterSignerFromWarpcast();
  };

  const contextValue: AuthContextType = {
    ...authState,
    connectWallet,
    disconnect,
    signMessage,
    switchChain,
    getFarcasterSigner,
    farcasterSigner: {
      hasActiveSigner,
      requestSigner,
    },
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Unified authentication provider
export function UnifiedAuthProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider {...privyConfig}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#E87722',
            borderRadius: 'medium',
          })}
        >
          <AuthStateManager>
            {children}
          </AuthStateManager>
        </RainbowKitProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}

