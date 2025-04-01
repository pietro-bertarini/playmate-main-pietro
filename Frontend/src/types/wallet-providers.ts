// Wallet provider configurations with support for external image URLs
export interface WalletProvider {
  id: string;
  name: string;
  iconUrl: string;
  installUrl: string;
  detectInstalled: () => boolean;
  requestConnection?: () => Promise<any>;
}

/**
 * Collection of wallet providers with standardized interface
 * These are browsers/extensions that provide direct wallet functionality
 */
export const walletProviders: WalletProvider[] = [
  {
    id: "metamask",
    name: "MetaMask",
    iconUrl: "https://cdn.iconscout.com/icon/free/png-256/free-metamask-2728406-2261817.png",
    installUrl: "https://metamask.io/download/",
    detectInstalled: () => typeof window !== 'undefined' && !!window.ethereum?.isMetaMask,
    requestConnection: async () => {
      if (!window.ethereum?.isMetaMask) return null;
      try {
        // Force MetaMask to show its account selection UI
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
        return window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        console.error("Error requesting MetaMask connection:", error);
        return null;
      }
    }
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    iconUrl: "https://play-lh.googleusercontent.com/PjoJoG27miSglVBXoXrxBSLveV6e3EeBPpNY55aiUUBM9Q1RCETKCOqdOkX2ZydqVf0=w240-h480-rw",
    installUrl: "https://www.coinbase.com/wallet/downloads",
    detectInstalled: () => typeof window !== 'undefined' && !!window.ethereum?.isCoinbaseWallet,
    requestConnection: async () => {
      if (!window.ethereum?.isCoinbaseWallet) return null;
      try {
        return window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        console.error("Error requesting Coinbase connection:", error);
        return null;
      }
    }
  },
  {
    id: "brave",
    name: "Brave Wallet",
    iconUrl: "https://brave.com/static-assets/images/brave-logo.svg",
    installUrl: "https://brave.com/download/",
    detectInstalled: () => typeof window !== 'undefined' && !!window.ethereum?.isBraveWallet,
    requestConnection: async () => {
      if (!window.ethereum?.isBraveWallet) return null;
      try {
        return window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        console.error("Error requesting Brave Wallet connection:", error);
        return null;
      }
    }
  }
]; 