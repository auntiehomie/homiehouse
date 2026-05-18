/**
 * Wallet Integration Service
 * Supports WalletConnect v2, MetaMask, and fallback wallet options
 */

import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { Core } from '@walletconnect/core';
import { Web3Wallet } from '@walletconnect/web3wallet';
import { Web3Error } from '@/config/web3';
import { walletConnectConfig } from '@/config/web3';

// Wallet connection state
export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  provider: 'metamask' | 'walletconnect' | 'rainbowkit' | 'privy' | null;
  balance: string | null;
}

// Wallet connection options
export interface WalletConnectOptions {
  chainId?: number;
  rpcUrls?: Record<number, string>;
  qrcodeModalOptions?: {
    mobileLinks?: string[];
    desktopLinks?: string[];
  };
}

// Message signing result
export interface SignMessageResult {
  signature: string;
  address: string;
}

// Wallet signature types
export type WalletSignatureType = 'personal_message' | 'typed_data' | 'eip712';

class WalletService {
  private provider: any = null;
  private walletConnectInit: any = null;
  private isInitialized = false;
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.initializeWalletConnect();
  }

  // Event handling
  private emit(event: string, data: any) {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(listener => listener(data));
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  // Initialize WalletConnect v2
  private async initializeWalletConnect() {
    try {
      if (!walletConnectConfig.projectId) {
        console.warn('WalletConnect project ID not configured');
        return;
      }

      const core = new Core({
        projectId: walletConnectConfig.projectId,
      });

      this.walletConnectInit = await Web3Wallet.init({
        core: core as any,
        metadata: walletConnectConfig.metadata,
      });

      this.isInitialized = true;
      console.log('WalletConnect v2 initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WalletConnect v2:', error);
      throw new Web3Error(
        'Failed to initialize WalletConnect',
        'WALLETCONNECT_INIT_FAILED',
        error
      );
    }
  }

  // Get Ethereum provider for WalletConnect
  private async getWalletConnectProvider(options: WalletConnectOptions = {}): Promise<any> {
    try {
      if (!this.isInitialized) {
        await this.initializeWalletConnect();
      }

      const provider = await EthereumProvider.init({
        projectId: walletConnectConfig.projectId,
        chains: [options.chainId || 1],
        showQrModal: true,
        qrModalOptions: {
          desktopLinks: options.qrcodeModalOptions?.desktopLinks || [
            'ledger',
            'coinbase',
            'metamask',
            'trust',
          ],
          mobileLinks: options.qrcodeModalOptions?.mobileLinks || [
            'metamask',
            'trust',
            'rainbow',
            'ledger',
          ],
        },
        metadata: walletConnectConfig.metadata,
      });

      // Set up event listeners
      provider.on('accountsChanged', (accounts: string[]) => {
        console.log('WalletConnect accounts changed:', accounts);
        this.emit('accountsChanged', accounts);
      });

      provider.on('chainChanged', (chainId: string) => {
        console.log('WalletConnect chain changed:', chainId);
        this.emit('chainChanged', parseInt(chainId, 16));
      });

      provider.on('disconnect', () => {
        console.log('WalletConnect disconnected');
        this.emit('disconnect', null);
      });

      return provider;
    } catch (error) {
      console.error('Failed to get WalletConnect provider:', error);
      throw new Web3Error(
        'Failed to initialize WalletConnect provider',
        'WALLETCONNECT_PROVIDER_FAILED',
        error
      );
    }
  }

  // Check if MetaMask is available
  private isMetaMaskAvailable(): boolean {
    return typeof window !== 'undefined' && 
           (window as any).ethereum !== undefined && 
           (window as any).ethereum.isMetaMask === true;
  }

  // Get MetaMask provider
  private getMetaMaskProvider(): any {
    if (!this.isMetaMaskAvailable()) {
      throw new Web3Error(
        'MetaMask is not available. Please install MetaMask extension.',
        'METAMASK_NOT_AVAILABLE'
      );
    }

    const provider = (window as any).ethereum;
    
    // Set up event listeners
    provider.on('accountsChanged', (accounts: string[]) => {
      console.log('MetaMask accounts changed:', accounts);
      this.emit('accountsChanged', accounts);
    });

    provider.on('chainChanged', (chainId: string) => {
      console.log('MetaMask chain changed:', chainId);
      this.emit('chainChanged', parseInt(chainId, 16));
    });

    provider.on('disconnect', () => {
      console.log('MetaMask disconnected');
      this.emit('disconnect', null);
    });

    return provider;
  }

  // Connect to wallet
  async connectWallet(
    walletType: 'metamask' | 'walletconnect' | 'rainbowkit',
    options: WalletConnectOptions = {}
  ): Promise<WalletState> {
    try {
      console.log(`[WalletService] Connecting to ${walletType}...`);

      let provider;
      let address;
      let chainId;

      switch (walletType) {
        case 'metamask':
          provider = this.getMetaMaskProvider();
          
          // Request account access
          const accounts = await provider.request({ 
            method: 'eth_requestAccounts' 
          });
          
          // Get chain ID
          const networkId = await provider.request({ 
            method: 'eth_chainId' 
          });
          
          address = accounts[0];
          chainId = parseInt(networkId, 16);
          break;

        case 'walletconnect':
          provider = await this.getWalletConnectProvider(options);
          
          // Enable provider
          await provider.enable();
          
          address = provider.accounts[0];
          chainId = provider.chainId;
          break;

        case 'rainbowkit':
          // RainbowKit connections are handled by the RainbowKit provider
          // This is a fallback implementation
          throw new Web3Error(
            'RainbowKit connections should be handled by RainbowKit provider',
            'RAINBOWKIT_NOT_SUPPORTED'
          );

        default:
          throw new Web3Error(
            `Unsupported wallet type: ${walletType}`,
            'UNSUPPORTED_WALLET_TYPE'
          );
      }

      this.provider = provider;

      const walletState: WalletState = {
        isConnected: true,
        address: address.toLowerCase(),
        chainId,
        provider: walletType as any,
        balance: null, // Will be fetched separately
      };

      console.log(`[WalletService] Connected successfully:`, walletState);
      this.emit('connected', walletState);

      return walletState;
    } catch (error) {
      console.error(`[WalletService] Connection failed:`, error);
      
      if (error instanceof Web3Error) {
        throw error;
      }
      
      throw new Web3Error(
        `Failed to connect to ${walletType}`,
        'WALLET_CONNECTION_FAILED',
        error
      );
    }
  }

  // Disconnect wallet
  async disconnect(): Promise<void> {
    try {
      if (!this.provider) {
        return;
      }

      console.log('[WalletService] Disconnecting wallet...');

      if (this.provider.disconnect) {
        await this.provider.disconnect();
      }

      this.provider = null;
      
      const walletState: WalletState = {
        isConnected: false,
        address: null,
        chainId: null,
        provider: null,
        balance: null,
      };

      this.emit('disconnected', walletState);
      console.log('[WalletService] Disconnected successfully');
    } catch (error) {
      console.error('[WalletService] Disconnect failed:', error);
      throw new Web3Error(
        'Failed to disconnect wallet',
        'WALLET_DISCONNECT_FAILED',
        error
      );
    }
  }

  // Sign a message
  async signMessage(
    message: string,
    type: WalletSignatureType = 'personal_message'
  ): Promise<SignMessageResult> {
    if (!this.provider || !this.provider.request) {
      throw new Web3Error(
        'No wallet provider available',
        'NO_PROVIDER_AVAILABLE'
      );
    }

    try {
      console.log('[WalletService] Signing message...', { type, messageLength: message.length });

      let signature;
      let address;

      switch (type) {
        case 'personal_message':
          // Get the current account
          const accounts = await this.provider.request({
            method: 'eth_accounts',
          });
          
          if (!accounts || accounts.length === 0) {
            throw new Web3Error(
              'No wallet accounts available',
              'NO_ACCOUNTS_AVAILABLE'
            );
          }

          address = accounts[0];

          // Sign personal message
          signature = await this.provider.request({
            method: 'personal_sign',
            params: [
              `0x${Buffer.from(message, 'utf8').toString('hex')}`,
              address,
            ],
          });
          break;

        case 'typed_data':
        case 'eip712':
          throw new Web3Error(
            'Typed data signing not yet implemented',
            'TYPED_DATA_NOT_IMPLEMENTED'
          );

        default:
          throw new Web3Error(
            `Unsupported signature type: ${type}`,
            'UNSUPPORTED_SIGNATURE_TYPE'
          );
      }

      const result: SignMessageResult = {
        signature,
        address: address.toLowerCase(),
      };

      console.log('[WalletService] Message signed successfully', {
        address: result.address,
        signatureLength: result.signature.length,
      });

      this.emit('messageSigned', result);
      return result;
    } catch (error) {
      console.error('[WalletService] Message signing failed:', error);
      
      if (error instanceof Web3Error) {
        throw error;
      }
      
      throw new Web3Error(
        'Failed to sign message',
        'MESSAGE_SIGNING_FAILED',
        error
      );
    }
  }

  // Switch chain
  async switchChain(chainId: number): Promise<void> {
    if (!this.provider || !this.provider.request) {
      throw new Web3Error(
        'No wallet provider available',
        'NO_PROVIDER_AVAILABLE'
      );
    }

    try {
      console.log('[WalletService] Switching chain...', { chainId });

      await this.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });

      console.log('[WalletService] Chain switched successfully', { chainId });
      this.emit('chainSwitched', chainId);
    } catch (error: any) {
      console.error('[WalletService] Chain switch failed:', error);
      
      // If chain is not added to wallet, try to add it
      if (error.code === 4902) {
        console.log('[WalletService] Chain not available, trying to add...');
        // This would require chain configuration - implement as needed
      }
      
      throw new Web3Error(
        `Failed to switch to chain ${chainId}`,
        'CHAIN_SWITCH_FAILED',
        error
      );
    }
  }

  // Get current wallet state
  async getWalletState(): Promise<WalletState> {
    if (!this.provider) {
      return {
        isConnected: false,
        address: null,
        chainId: null,
        provider: null,
        balance: null,
      };
    }

    try {
      const accounts = await this.provider.request({ method: 'eth_accounts' });
      const chainId = await this.provider.request({ method: 'eth_chainId' });

      return {
        isConnected: accounts.length > 0,
        address: accounts[0] ? accounts[0].toLowerCase() : null,
        chainId: parseInt(chainId, 16),
        provider: 'walletconnect', // This would need to be tracked
        balance: null, // Would need separate balance fetch
      };
    } catch (error) {
      console.error('[WalletService] Failed to get wallet state:', error);
      return {
        isConnected: false,
        address: null,
        chainId: null,
        provider: null,
        balance: null,
      };
    }
  }

  // Check if wallet is available
  isWalletAvailable(walletType: 'metamask' | 'walletconnect' | 'rainbowkit'): boolean {
    switch (walletType) {
      case 'metamask':
        return this.isMetaMaskAvailable();
      case 'walletconnect':
        return this.isInitialized;
      case 'rainbowkit':
        return true; // RainbowKit is always available if included
      default:
        return false;
    }
  }

  // Get available wallets
  getAvailableWallets(): Array<{ type: string; name: string; available: boolean }> {
    return [
      { type: 'metamask', name: 'MetaMask', available: this.isMetaMaskAvailable() },
      { type: 'walletconnect', name: 'WalletConnect', available: this.isInitialized },
            { type: 'rainbowkit', name: 'RainbowKit', available: true },
    ];
  }
}

// Export singleton instance
export const walletService = new WalletService();
export default walletService;