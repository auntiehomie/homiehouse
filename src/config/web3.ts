/**
 * Web3 Configuration
 * Unified configuration for wallet providers, chains, and Web3 services
 */

import { configureChains, createConfig } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { infuraProvider } from 'wagmi/providers/infura';

// Chain configuration
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet, polygon, optimism, arbitrum, base],
  [
    alchemyProvider({ 
      apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '',
      priority: 0 
    }),
    infuraProvider({ 
      apiKey: process.env.NEXT_PUBLIC_INFURA_API_KEY || '',
      priority: 1 
    }),
    publicProvider({ priority: 2 }),
  ]
);

// Wagmi configuration
export const wagmiConfig = createConfig({
  autoConnect: true,
  publicClient,
  webSocketPublicClient,
});

export { chains };

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
export const privyConfig = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
  config: {
    loginMethods: ['farcaster', 'wallet', 'email'],
    appearance: {
      theme: 'dark' as const,
      accentColor: '#E87722',
      logo: 'https://1481393129444737075.vercel.app/logo.png',
    },
    embeddedWallets: {
      ethereum: {
        createOnLogin: 'users-without-wallets' as const,
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
    rpcUrls: ['https://eth-mainnet.alchemyapi.io/v2/', 'https://mainnet.infura.io/v3/'],
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrls: ['https://polygon-mainnet.g.alchemyapi.io/v2/', 'https://polygon-rpc.com'],
  },
  optimism: {
    id: 10,
    name: 'Optimism',
    symbol: 'ETH',
    rpcUrls: ['https://opt-mainnet.g.alchemyapi.io/v2/', 'https://mainnet.optimism.io'],
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum',
    symbol: 'ETH',
    rpcUrls: ['https://arb-mainnet.g.alchemyapi.io/v2/', 'https://arb1.arbitrum.io/rpc'],
  },
  base: {
    id: 8453,
    name: 'Base',
    symbol: 'ETH',
    rpcUrls: ['https://base-mainnet.g.alchemyapi.io/v2/', 'https://mainnet.base.org'],
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
    public details?: any
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