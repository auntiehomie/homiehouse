/**
 * Web3 Configuration
 * Unified configuration for wallet providers, chains, and Web3 services
 * Updated for wagmi v3 / viem v2 (configureChains removed; use http() transports)
 */

import { createConfig, http } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';

// Wagmi v3 config — no configureChains, no provider subpaths.
// Transports are per-chain; fall back to the public RPC when API keys are absent.
export const wagmiConfig = createConfig({
  chains: [mainnet, polygon, optimism, arbitrum, base],
  transports: {
    [mainnet.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
        ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
        : undefined
    ),
    [polygon.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
        ? `https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
        : undefined
    ),
    [optimism.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
        ? `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
        : undefined
    ),
    [arbitrum.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
        ? `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
        : undefined
    ),
    [base.id]: http(
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
        ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
        : undefined
    ),
  },
});

// Convenience export — the configured chain list
export const chains = wagmiConfig.chains;

// WalletConnect v2 Configuration
export const walletConnectConfig = {
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  metadata: {
    name: 'HomieHouse',
    description: 'Your Social Hub for Web3',
    url: 'https://1481393129444737075.vercel.app',
    icons: ['https://1481393129444737075.vercel.app/logo.png'],
  },
};

// Privy Configuration
// Set NEXT_PUBLIC_PRIVY_APP_ID in the environment; an empty fallback makes
// missing configuration visible instead of silently using a dead app.
export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
  config: {
    appearance: {
      loginMethods: ['farcaster', 'wallet', 'email'] as ('farcaster' | 'wallet' | 'email')[],
      theme: 'dark' as const,
      accentColor: '#E87722' as `#${string}`,
      logo: 'https://1481393129444737075.vercel.app/logo.png',
    },
    embeddedWallets: {
      ethereum: {
        // 'all-users' is required for Farcaster embedded signers:
        // every Farcaster-logged-in user needs an embedded wallet before
        // requestFarcasterSignerFromWarpcast() can be called.
        createOnLogin: 'all-users' as const,
        showWalletUIs: true,
      },
    },
  },
};

// Piñata Configuration
export const pinataConfig = {
  jwt: process.env.PINATA_JWT || '',
  gateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud',
};

// Farcaster Configuration
export const farcasterConfig = {
  hubUrl: process.env.NEXT_PUBLIC_FARCASTER_HUB_URL || 'https://hub.pinata.cloud',
  network: process.env.NEXT_PUBLIC_FARCASTER_NETWORK || 'mainnet',
};

// Multi-chain token configuration
export const supportedChains = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrls: ['https://eth-mainnet.g.alchemy.com/v2/', 'https://mainnet.infura.io/v3/'],
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrls: ['https://polygon-mainnet.g.alchemy.com/v2/', 'https://polygon-rpc.com'],
  },
  optimism: {
    id: 10,
    name: 'Optimism',
    symbol: 'ETH',
    rpcUrls: ['https://opt-mainnet.g.alchemy.com/v2/', 'https://mainnet.optimism.io'],
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum',
    symbol: 'ETH',
    rpcUrls: ['https://arb-mainnet.g.alchemy.com/v2/', 'https://arb1.arbitrum.io/rpc'],
  },
  base: {
    id: 8453,
    name: 'Base',
    symbol: 'ETH',
    rpcUrls: ['https://base-mainnet.g.alchemy.com/v2/', 'https://mainnet.base.org'],
  },
};

// Environment validation
export function validateWeb3Config(): void {
  const requiredEnvVars = [
    'NEXT_PUBLIC_PRIVY_APP_ID',
    'PINATA_JWT',
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.warn('Missing Web3 environment variables:', missing);
  }
}

// Error handling for Web3 operations
export class Web3Error extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'Web3Error';
  }
}

// Chain utilities
export function getChainById(chainId: number) {
  return Object.values(supportedChains).find(chain => chain.id === chainId);
}

export function getChainName(chainId: number): string {
  const chain = getChainById(chainId);
  return chain?.name || 'Unknown Chain';
}

export function getChainSymbol(chainId: number): string {
  const chain = getChainById(chainId);
  return chain?.symbol || 'ETH';
}
