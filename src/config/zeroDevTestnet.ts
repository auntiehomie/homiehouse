import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { zeroDevWallet } from '@zerodev/wallet-react';

const projectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID?.trim();

export const zeroDevProjectConfigured = Boolean(projectId);

export const zeroDevTestnetConfig = createConfig({
  chains: [baseSepolia],
  connectors: projectId
    ? [
        zeroDevWallet({
          projectId,
          chains: [baseSepolia],
          mode: '7702',
        }),
      ]
    : [],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: true,
});
