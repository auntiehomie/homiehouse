'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { wagmiConfig, walletConnectConfig, privyConfig } from '@/config/web3';
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

// Unified authentication provider
export function UnifiedAuthProvider({ children }: { children: ReactNode }) {
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

  // Initialize authentication on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      // Check for existing session
      const savedAuth = localStorage.getItem('homiehouse_auth');
      if (savedAuth) {
        const parsed = JSON.parse(savedAuth);
        setAuthState(prev => ({
          ...prev,
          ...parsed,
          isLoading: false,
        }));
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: new Web3Error('Failed to initialize authentication', 'AUTH_INIT_FAILED', error)
      }));
    }
  };

  const saveAuthState = (newState: Partial<AuthState>) => {
    const updatedState = { ...authState, ...newState };
    setAuthState(updatedState);
    
    // Persist to localStorage
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
      
      // Provider-specific connection logic will be implemented in child components
      // For now, we'll trigger Privy login
      window.dispatchEvent(new CustomEvent('homiehouse:connect-wallet', { 
        detail: { provider } 
      }));
      
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isConnecting: false,
        error: new Web3Error('Failed to connect wallet', 'WALLET_CONNECTION_FAILED', error)
      }));
      throw error;
    }
  };

  const disconnect = async () => {
    try {
      setAuthState(prev => ({ ...prev, isConnecting: true }));
      
      // Clear local storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('homiehouse_auth');
      }
      
      // Reset state
      setAuthState({
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
        isLoading: false,
        error: null,
      });
      
      // Dispatch disconnect event
      window.dispatchEvent(new CustomEvent('homiehouse:disconnect-wallet'));
      
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isConnecting: false,
        error: new Web3Error('Failed to disconnect', 'DISCONNECT_FAILED', error)
      }));
    }
  };

  const signMessage = async (message: string): Promise<string> => {
    if (!authState.isAuthenticated || !authState.wallet.address) {
      throw new Web3Error('Not authenticated', 'NOT_AUTHENTICATED');
    }
    
    // Message signing will be implemented via provider-specific logic
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
      
      // Request signature
      window.dispatchEvent(new CustomEvent('homiehouse:sign-message', { 
        detail: { message } 
      }));
    });
  };

  const switchChain = async (chainId: number) => {
    if (!authState.isAuthenticated) {
      throw new Web3Error('Not authenticated', 'NOT_AUTHENTICATED');
    }
    
    // Chain switching will be implemented via provider-specific logic
    window.dispatchEvent(new CustomEvent('homiehouse:switch-chain', { 
      detail: { chainId } 
    }));
  };

  const getFarcasterSigner = async () => {
    // Use Privy to get the signer
    const { authenticated, user } = usePrivy();

    if (!authenticated || !user) {
        console.log("User not authenticated with Privy");
        return null;
    }

    // Placeholder: Replace with actual Privy signer retrieval logic
    const signer = "DUMMY_PRIVY_SIGNER"; 

    return {
      signerUuid: signer,
      fid: user.id,
    };
  };

  const contextValue: AuthContextType = {
    ...authState,
    connectWallet,
    disconnect,
    signMessage,
    switchChain,
    getFarcasterSigner,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      <PrivyProvider {...privyConfig}>
        <WagmiConfig config={wagmiConfig}>
          <RainbowKitProvider
            chains={chains}
            theme={darkTheme({
              accentColor: '#E87722',
              borderRadius: 'medium',
            })}
          >
            {children}
          </RainbowKitProvider>
        </WagmiConfig>
      </PrivyProvider>
    </AuthContext.Provider>
  );
}