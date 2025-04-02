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
  // Reset on each connection attempt to avoid initialization issues
  if (manuallyDisconnected) {
    console.log("Manual disconnect flag found, resetting provider for clean start");
    resetProvider();
    localStorage.removeItem('walletManuallyDisconnected');
  }

  // Return the existing provider if already initialized
  if (provider) {
    console.log("Using existing provider");
    return provider;
  }

  // If initialization is in progress, return the existing promise
  if (providerInitializing && providerInitPromise) {
    console.log("Provider initialization already in progress, returning existing promise");
    return providerInitPromise;
  }

  // Set initialization flag
  providerInitializing = true;

  // Create the initialization promise
  providerInitPromise = new Promise(async (resolve, reject) => {
    try {
      console.log("Initializing WalletConnect provider...");

      const newProvider = await EthereumProvider.init({
        projectId: PROJECT_ID,
        showQrModal: true, // Show QR code modal with wallet selection
        qrModalOptions: {
          themeMode: 'dark',
          themeVariables: {
            '--wcm-z-index': '9999', // Ensure modal appears above everything
          },
          explorerRecommendedWalletIds: ['metamask'], // Ensure MetaMask is recommended
          enableExplorer: true, // Enable wallet explorer
        },
        chains: [1], // Default to Ethereum mainnet
        optionalChains: getNumericChainIds(), // Add other chains as optional
        methods: ["eth_sendTransaction", "personal_sign", "eth_sign", "eth_signTypedData"],
        events: ["chainChanged", "accountsChanged", "disconnect", "connect"],
        metadata: {
          name: 'Playmate App',
          description: 'Connect your wallet to Playmate',
          url: window.location.origin,
          icons: ['https://playmate.com/logo.png'] // Replace with your app logo
        }
      });

      // Store the provider globally
      provider = newProvider;
      resolve(provider);
    } catch (error) {
      console.error("Failed to initialize EthereumProvider:", error);
      // Reset initialization flags on error
      providerInitializing = false;
      providerInitPromise = null;
      // Clean up any partial provider
      provider = null;
      reject(error);
    }
  });

  try {
    // Wait for initialization to complete
    const result = await providerInitPromise;
    return result;
  } catch (error) {
    // Reset everything on error to allow for retry
    resetProvider();
    throw error;
  } finally {
    // Reset initialization flag when done (whether success or failure)
    providerInitializing = false;
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
 * Uses the built-in QR code modal with desktop options
 */
export const initiateWalletConnectFlow = async (): Promise<string[]> => {
  console.log("Starting WalletConnect flow...");
  try {
    // Reset any existing provider first
    resetProvider();

    // Initialize a fresh WalletConnect provider
    console.log("Initializing provider...");
    const wcProvider = await initEthereumProvider();
    console.log("Provider initialized:", wcProvider);

    // Setup listeners for connection events
    const connectionPromise = new Promise<string[]>((resolve, reject) => {
      console.log("Setting up connection event listeners...");

      // Listen for the 'connect' event
      const onConnect = (connectedAccounts: string[]) => {
        console.log("Connect event received with accounts:", connectedAccounts);
        if (connectedAccounts && connectedAccounts.length > 0) {
          wcProvider.removeListener('connect', onConnect);
          wcProvider.removeListener('error', onError);
          wcProvider.removeListener('disconnect', onDisconnect);
          resolve(connectedAccounts);
        } else if (wcProvider.accounts && wcProvider.accounts.length > 0) {
          // Handle case where connect event might not have the accounts
          console.log("Using accounts from provider:", wcProvider.accounts);
          wcProvider.removeListener('connect', onConnect);
          wcProvider.removeListener('error', onError);
          wcProvider.removeListener('disconnect', onDisconnect);
          resolve(wcProvider.accounts);
        }
      };

      // Listen for connection errors
      const onError = (error: any) => {
        console.log("Error event received:", error);
        // Create a standardized error object similar to MetaMask
        const formattedError = {
          code: 4001,
          message: 'User rejected the request.',
          stack: error.toString()
        };
        wcProvider.removeListener('connect', onConnect);
        wcProvider.removeListener('error', onError);
        wcProvider.removeListener('disconnect', onDisconnect);
        reject(formattedError);
      };

      // Listen for disconnection
      const onDisconnect = () => {
        console.log("Disconnect event received");
        // Create a standardized error object similar to MetaMask
        const formattedError = {
          code: 4001,
          message: 'User rejected the request.',
          stack: 'WalletConnect disconnected'
        };
        wcProvider.removeListener('connect', onConnect);
        wcProvider.removeListener('error', onError);
        wcProvider.removeListener('disconnect', onDisconnect);
        reject(formattedError);
      };

      // Add event listeners
      wcProvider.on('connect', onConnect);
      wcProvider.on('error', onError);
      wcProvider.on('disconnect', onDisconnect);

      // Add explicit accountsChanged handler
      const onAccountsChanged = (newAccounts: string[]) => {
        console.log("Accounts changed event received:", newAccounts);
        if (newAccounts && newAccounts.length > 0) {
          wcProvider.removeListener('connect', onConnect);
          wcProvider.removeListener('error', onError);
          wcProvider.removeListener('disconnect', onDisconnect);
          wcProvider.removeListener('accountsChanged', onAccountsChanged);
          resolve(newAccounts);
        }
      };
      wcProvider.on('accountsChanged', onAccountsChanged);

      // Also check if we're already connected
      setTimeout(() => {
        if (wcProvider.accounts && wcProvider.accounts.length > 0) {
          console.log("Provider already has accounts:", wcProvider.accounts);
          wcProvider.removeListener('connect', onConnect);
          wcProvider.removeListener('error', onError);
          wcProvider.removeListener('disconnect', onDisconnect);
          wcProvider.removeListener('accountsChanged', onAccountsChanged);
          resolve(wcProvider.accounts);
        }
      }, 1000);
      
      // Add a timeout to prevent hanging indefinitely
      const connectionTimeout = setTimeout(() => {
        console.log("Connection timeout after 30 seconds");
        wcProvider.removeListener('connect', onConnect);
        wcProvider.removeListener('error', onError);
        wcProvider.removeListener('disconnect', onDisconnect);
        wcProvider.removeListener('accountsChanged', onAccountsChanged);
        
        // Check once more if we have accounts before rejecting
        if (wcProvider.accounts && wcProvider.accounts.length > 0) {
          console.log("Found accounts before timeout:", wcProvider.accounts);
          resolve(wcProvider.accounts);
        } else {
          const timeoutError = {
            code: 4001,
            message: 'Connection timed out. User may have rejected the request or connection process took too long.',
            stack: 'WalletConnect connection timeout'
          };
          reject(timeoutError);
        }
      }, 30000); // 30 second timeout
      
      // Clean up timeout when promise resolves or rejects
      const cleanupTimeout = () => {
        clearTimeout(connectionTimeout);
      };
      
      // Add cleanup to our promise handlers
      connectionPromise.then(cleanupTimeout).catch(cleanupTimeout);
    });

    try {
      // Connect will show the QR code modal with desktop options
      console.log("Connecting provider (will show QR code modal)...");
      console.log("Provider state before connect:", {
        connected: wcProvider.connected,
        chainId: wcProvider.chainId,
        hasAccounts: wcProvider.accounts && wcProvider.accounts.length > 0,
      });
      
      await wcProvider.connect();
      
      console.log("Connection process started, waiting for result...");
      console.log("Provider state after connect call:", {
        connected: wcProvider.connected,
        chainId: wcProvider.chainId,
        hasAccounts: wcProvider.accounts && wcProvider.accounts.length > 0,
      });

      // Try to directly request accounts if available
      try {
        if (wcProvider.request) {
          console.log("Trying explicit eth_requestAccounts call");
          const accounts = await wcProvider.request({ method: 'eth_requestAccounts' });
          console.log("eth_requestAccounts result:", accounts);
          if (accounts && accounts.length > 0) {
            return accounts;
          }
        }
      } catch (requestError) {
        console.log("eth_requestAccounts failed, continuing with event listeners:", requestError);
      }

      // Wait for connection result
      return await connectionPromise;
    } catch (error: any) {
      // Clean up provider
      console.error("Error in WalletConnect flow:", error);

      // Standardize the error to match MetaMask's format
      const formattedError = {
        code: error.code || 4001,
        message: error.message || 'User rejected the request.',
        stack: error.stack || JSON.stringify(error)
      };
      throw formattedError;
    }
  } catch (error) {
    console.error('Error initiating WalletConnect:', error);
    // Always propagate the error so it can be handled by the ConnectWalletButton
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
