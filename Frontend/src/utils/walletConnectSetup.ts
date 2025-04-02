import { chains } from '../types/chains';
import { WalletConnectModal } from '@walletconnect/modal';
import { EthereumProvider } from '@walletconnect/ethereum-provider';

const PROJECT_ID = '6125bb2586f4b993ee30dcdab730a7fd';

// Initialize the WalletConnectModal instance
let walletConnectModal: WalletConnectModal | null = null;

// Initialize the EthereumProvider instance
let provider: any = null;
// Track initialization status
let providerInitializing = false;
// Store the initialization promise
let providerInitPromise: Promise<any> | null = null;

// Convert our chain configurations to CAIP-2 format
const getChainIds = () => {
  return chains.map(chain => `eip155:${parseInt(chain.id, 16)}`);
};

// Get numeric chain IDs
const getNumericChainIds = () => {
  return chains.map(chain => parseInt(chain.id, 16));
};

// Check if user is on mobile
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Check if MetaMask is installed
const isMetaMaskInstalled = () => {
  return typeof window !== 'undefined' &&
         typeof window.ethereum !== 'undefined' &&
         window.ethereum.isMetaMask;
};

// Check for manual disconnect flag
const manuallyDisconnected = localStorage.getItem('walletManuallyDisconnected') === 'true';

export const initWalletConnectModal = () => {
  try {
    // If we already have an instance, return it
    if (walletConnectModal) {
      console.log("Reusing existing WalletConnect modal");
      return walletConnectModal;
    }

    console.log("Creating new WalletConnect modal");
    walletConnectModal = new WalletConnectModal({
      projectId: PROJECT_ID,
      chains: ["eip155:1"], // Support Ethereum mainnet for now
      themeMode: 'dark',
    });

    return walletConnectModal;
  } catch (error) {
    console.error("Error initializing WalletConnect modal:", error);
    // In case of error, reset the modal
    walletConnectModal = null;
    // Try again with a simpler configuration
    walletConnectModal = new WalletConnectModal({
      projectId: PROJECT_ID,
      enableExplorer: true,
      explorerRecommendedWalletIds: ['metamask']
    });
    return walletConnectModal;
  }
};

// Initialize the EthereumProvider
export const initEthereumProvider = async (): Promise<any> => {
  // Return the existing provider if already initialized
  if (provider) {
    console.log("Using existing provider");
    return provider;
  }

  try {
    console.log("Initializing WalletConnect provider...");
    provider = await EthereumProvider.init({
      projectId: PROJECT_ID,
      showQrModal: true,
      qrModalOptions: {
        themeMode: 'dark',
        themeVariables: {
          '--wcm-z-index': '9999',
        },
        enableExplorer: true,
      },
      chains: [1],
      methods: ["personal_sign", "eth_sign"],
      events: ["chainChanged", "accountsChanged", "disconnect", "connect"],
      metadata: {
        name: 'Playmate App',
        description: 'Connect your wallet to Playmate',
        url: window.location.origin,
        icons: ['https://playmate.com/logo.png']
      }
    });

    return provider;
  } catch (error) {
    console.error("Failed to initialize EthereumProvider:", error);
    provider = null;
    throw error;
  }
};

/**
 * Directly connect to MetaMask if it's installed
 */
export const connectToMetaMask = async (): Promise<string[]> => {
  try {
    if (!isMetaMaskInstalled()) {
      throw new Error("MetaMask is not installed");
    }

    // Use the ethereum object with proper type safety
    const ethereum = window.ethereum as any;

    // Request accounts from MetaMask
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

    if (accounts && accounts.length > 0) {
      return accounts;
    } else {
      throw new Error("No accounts found");
    }
  } catch (error: any) {
    console.error("Error connecting to MetaMask:", error);

    // Standardize the error to match MetaMask's format
    const formattedError = {
      code: error.code || 4001,
      message: error.message || 'User rejected the request.',
      stack: error.stack || JSON.stringify(error)
    };
    throw formattedError;
  }
};

/**
 * Reset the WalletConnect provider and associated state
 */
export function resetProvider() {
  console.log('Resetting WalletConnect provider state');
  provider = null;
  providerInitializing = false;
  providerInitPromise = null;

  // Clear the manual disconnect flag
  localStorage.removeItem('walletManuallyDisconnected');

  // Close any existing modal
  if (walletConnectModal) {
    try {
      walletConnectModal.closeModal();
    } catch (error) {
      console.error('Error closing WalletConnect modal:', error);
    }
    walletConnectModal = null;
  }
}

/**
 * Initiates the WalletConnect connection flow
 */
export const initiateWalletConnectFlow = async (): Promise<string[]> => {
  console.log("Starting WalletConnect flow...");
  try {
    // Initialize provider if needed
    const wcProvider = await initEthereumProvider();
    console.log("Provider initialized:", wcProvider);

    // Connect and wait for accounts
    await wcProvider.connect();
    console.log("Connected to WalletConnect");

    // Get accounts from the session
    if (wcProvider.accounts && wcProvider.accounts.length > 0) {
      console.log("Got accounts from session:", wcProvider.accounts);
      return wcProvider.accounts;
    }

    // If no accounts in session, request them
    try {
      const accounts = await wcProvider.request({ method: 'eth_requestAccounts' });
      console.log("Requested accounts:", accounts);
      return accounts;
    } catch (error) {
      console.error("Error requesting accounts:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in WalletConnect flow:", error);
    throw error;
  }
};

export const disconnectWalletConnect = async () => {
  // Close the modal if it's open
  const modal = initWalletConnectModal();
  modal.closeModal();

  // Disconnect the provider if it exists
  if (provider) {
    try {
      await provider.disconnect();
    } catch (error) {
      console.error("Error disconnecting provider:", error);
    }

    // Reset the provider to ensure clean state
    resetProvider();
  }
};

export const getWalletConnectModal = () => {
  return walletConnectModal || initWalletConnectModal();
};

export const getWalletConnectProvider = () => {
  return provider;
};

export const subscribeToModalEvents = (callback: (state: any) => void) => {
  const modal = initWalletConnectModal();
  return modal.subscribeModal(callback);
};

/**
 * Open the WalletConnect modal directly (using EthereumProvider's modal)
 */
export const openWalletConnectModal = async (): Promise<void> => {
  console.log("Opening WalletConnect modal directly...");
  try {
    // Clean up any existing state first
    resetProvider();

    // Initialize a fresh provider
    const wcProvider = await initEthereumProvider();

    // This will show the modal with desktop options and QR code
    wcProvider.connect().catch((error: any) => {
      console.error("Connection error:", error);
    });
    console.log("WalletConnect modal opening process started");
  } catch (error) {
    console.error("Error opening WalletConnect modal:", error);
    throw error;
  }
};
