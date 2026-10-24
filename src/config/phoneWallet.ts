import type { Wallet } from '@rainbow-me/rainbowkit';
import { walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';

// Keep pairing in RainbowKit's QR UI. The built-in `walletConnect` wallet
// additionally creates a showQrModal connector that loads a second modal SDK.
// A distinct wallet ID avoids that extra connector while preserving WC support.
export const phoneWallet = (options: Parameters<typeof walletConnectWallet>[0]): Wallet => ({
  ...walletConnectWallet(options),
  id: 'homiehouse-phone-wallet',
  name: 'WalletConnect',
});
