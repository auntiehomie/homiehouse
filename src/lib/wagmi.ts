import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, mainnet, optimism } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'HomieHouse',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [base, mainnet, optimism],
  ssr: true,
});
