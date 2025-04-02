import React, { useState, useEffect, useCallback, useRef } from "react";
import { chains } from "../../types/chains";
import { walletProviders } from "../../types/wallet-providers";
import { disconnectWalletConnect, getWalletConnectProvider, resetProvider, openWalletConnectModal, initiateWalletConnectFlow } from '../../utils/walletConnectSetup';
import { Web3Provider } from '@ethersproject/providers';
import Web3 from 'web3';
import { useModal } from '@/contexts/ModalContext';
import { formatEllipsisTxt } from '@/helpers/formatters';

/**
 * A standalone wallet connection component that handles connecting to
 * and managing Ethereum wallet providers like MetaMask, Coinbase, Brave and WalletConnect
 */
export function ConnectWalletButton(): JSX.Element {
  const [account, setAccount] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [currentChain, setCurrentChain] = useState<string | null>(null);
  const [walletProvider, setWalletProvider] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState<'networks' | 'accounts'>('networks');
  const menuRef = useRef<HTMLDivElement>(null);

  // Define disconnectWallet using useCallback to avoid dependency issues
  const disconnectWallet = useCallback(() => {
    // Reset all state variables to their initial values
    setAccount(null);
    setAccounts([]);
    setCurrentChain(null);
    setWalletProvider(null);
    setMenuOpen(false);
    setMenuTab('networks');

    // Clear any stored wallet connection data
    if (typeof window !== 'undefined') {
      // Some wallets store connection state in localStorage
      try {
        // Remove any wallet-specific connection data if exists
        localStorage.removeItem('walletconnect');
        localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE');
      } catch (error) {
        console.error("Error clearing wallet connection data:", error);
      }
    }
  }, []);

  // Check for WalletConnect provider on mount and set up listeners
  useEffect(() => {
    const wcProvider = getWalletConnectProvider();
    if (wcProvider) {
      // Check if already connected
      if (wcProvider.accounts && wcProvider.accounts.length > 0) {
        setAccounts(wcProvider.accounts);
        setAccount(wcProvider.accounts[0]);
        if (wcProvider.chainId) {
          setCurrentChain(`0x${wcProvider.chainId.toString(16)}`);
        }
        setWalletProvider('walletconnect');
        localStorage.setItem('walletConnectionActive', 'true');
      }

      // Set up event listeners
      wcProvider.on('accountsChanged', (newAccounts: string[]) => {
        if (newAccounts.length > 0) {
          setAccounts(newAccounts);
          setAccount(newAccounts[0]);
          localStorage.setItem('walletConnectionActive', 'true');
        } else {
          disconnectWallet();
        }
      });

      wcProvider.on('chainChanged', (chainId: number) => {
        setCurrentChain(`0x${chainId.toString(16)}`);
      });

      wcProvider.on('disconnect', () => {
        disconnectWallet();
      });

      // Clean up listeners on component unmount
      return () => {
        wcProvider.removeListener('accountsChanged', () => {});
        wcProvider.removeListener('chainChanged', () => {});
        wcProvider.removeListener('disconnect', () => {});
      };
    }
  }, [disconnectWallet]);

  useEffect(() => {
    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const connectWallet = async (providerId = 'metamask') => {
    // Clear the manual disconnect flag when user tries to connect again
    localStorage.removeItem('walletManuallyDisconnected');
    
    // Force disconnection of any existing wallet connection first
    if (account) {
      await handleDisconnect();
      // Short delay to ensure disconnection completes
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Find the selected provider
    const provider = walletProviders.find(p => p.id === providerId);
    if (!provider) {
      console.error(`Provider ${providerId} not found`);
      return;
    }
    
    setConnecting(true);
    setWalletProvider(providerId);
    
    try {
      // Special case for WalletConnect - try direct open first
      if (providerId === 'walletconnect') {
        try {
          console.log("Connecting to WalletConnect...");
          const walletAccounts = await initiateWalletConnectFlow();
          console.log("WalletConnect connection successful, accounts:", walletAccounts);
          
          if (walletAccounts && walletAccounts.length > 0) {
            setAccounts(walletAccounts);
            setAccount(walletAccounts[0]);
            
            // Get chain ID from WalletConnect provider
            const wcProvider = getWalletConnectProvider();
            if (wcProvider && wcProvider.chainId) {
              setCurrentChain(`0x${wcProvider.chainId.toString(16)}`);
            }
            
            setWalletProvider('walletconnect');
            localStorage.setItem('walletConnectionActive', 'true');
            return; // Exit early on success
          } else {
            console.log("No accounts returned from WalletConnect");
            throw new Error("No accounts returned from WalletConnect");
          }
        } catch (wcError: any) {
          console.error("WalletConnect connection error:", wcError);
          
          // If code is 4001, it's a user rejection
          if (wcError.code === 4001) {
            console.log("User rejected the WalletConnect connection");
            setWalletProvider(null);
            throw wcError; // Re-throw to be caught by the outer handler
          }
          
          // If we get here, there was some other error with WalletConnect
          setWalletProvider(null);
          throw wcError;
        }
      }
      
      // Check if provider is installed (skip this for WalletConnect)
      if (providerId !== 'walletconnect' && !provider.detectInstalled()) {
        // Open the install URL in a new tab
        window.open(provider.installUrl, '_blank');
        setConnecting(false);
        return;
      }
      
      // Request connection from the provider
      if (provider.requestConnection) {
        try {
          console.log(`Requesting connection from ${providerId}...`);
          const walletAccounts = await provider.requestConnection();
          console.log(`Got accounts from ${providerId}:`, walletAccounts);
          
          if (walletAccounts && walletAccounts.length > 0) {
            setAccounts(walletAccounts);
            setAccount(walletAccounts[0]);
            
            // Get the current chain ID
            if (providerId === 'walletconnect') {
              const wcProvider = getWalletConnectProvider();
              if (wcProvider && wcProvider.chainId) {
                setCurrentChain(`0x${wcProvider.chainId.toString(16)}`);
              }
            }
            
            // Set connection as active since user has explicitly approved
            localStorage.setItem('walletConnectionActive', 'true');
          } else {
            console.log("No accounts returned from connection request");
            // If no accounts were returned, it's likely user rejected
            setWalletProvider(null);
          }
        } catch (error: any) {
          // Handle user rejected request (error code 4001)
          if (error.code === 4001) {
            console.log("User rejected the connection request");
            // Reset wallet state since user rejected
            setWalletProvider(null);
          } else {
            // Log other errors but don't throw them
            console.error(`Connection error with ${providerId}:`, error);
            setWalletProvider(null);
          }
        }
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setWalletProvider(null);
    } finally {
      setConnecting(false);
      setMenuOpen(false);
    }
  };

  const switchChain = async (chainId: string) => {
    if (walletProvider === 'walletconnect') {
      // For WalletConnect, we currently don't support chain switching in this UI
      // The user would need to do that in their wallet app
      alert("Please switch networks in your WalletConnect compatible wallet app");
      setMenuOpen(false);
      return;
    }
    
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        const chain = chains.find(c => c.id === chainId);
        if (!chain) return;

        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chain.id,
                chainName: chain.name,
                rpcUrls: [chain.rpcUrl],
                nativeCurrency: {
                  name: chain.currency,
                  symbol: chain.currency,
                  decimals: 18,
                },
                blockExplorerUrls: [chain.blockExplorer],
              },
            ],
          });
        } catch (addError) {
          console.error("Error adding chain:", addError);
        }
      }
    } finally {
      setMenuOpen(false);
    }
  };

  const switchAccount = (newAccount: string) => {
    if (newAccount === account) return;

    // For WalletConnect, we don't support account switching in this UI
    if (walletProvider === 'walletconnect') {
      alert("Please switch accounts in your WalletConnect compatible wallet app");
      setMenuOpen(false);
      return;
    }

    // Request wallet to switch accounts
    if (window.ethereum) {
      try {
        // This will trigger the wallet UI to switch accounts
        window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        }).then(() => {
          // After permission is granted, accounts may have changed
          if (window.ethereum) {
            window.ethereum.request({ method: 'eth_accounts' }).then((walletAccounts: string[]) => {
              setAccounts(walletAccounts);
              if (walletAccounts.length > 0) {
                setAccount(walletAccounts[0]);
              }
            }).catch(error => {
              console.error("Error getting accounts after permission:", error);
            });
          }
        }).catch(error => {
          console.error("Error requesting permissions:", error);
        });
      } catch (error) {
        console.error("Error switching account:", error);
      }
    }
    setMenuOpen(false);
  };

  const shortenAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getChainName = () => {
    if (!currentChain) return "";
    const chain = chains.find(c => c.id === currentChain);
    return chain ? chain.name : "Unknown Chain";
  };

  /**
   * Reset all wallet state variables
   */
  const resetState = () => {
    setAccount(null);
    setAccounts([]);
    setCurrentChain(null);
    setWalletProvider(null);
    setMenuOpen(false);
    setMenuTab('networks');
    
    // Clear any stored wallet connection data
    try {
      localStorage.removeItem('walletconnect');
      localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE');
      localStorage.removeItem('wagmi.store');
      localStorage.removeItem('wagmi.wallet');
      localStorage.removeItem('wagmi.connected');
      
      // Clear session storage as well
      sessionStorage.clear();
    } catch (error) {
      console.error("Error clearing wallet connection data:", error);
    }
  };

  /**
   * Disconnect wallet
   */
  const handleDisconnect = () => {
    console.log('Disconnecting wallet...');
    
    return new Promise<void>((resolve) => {
      if (walletProvider === 'walletconnect') {
        // Mark as manually disconnected to prevent auto-reconnect
        localStorage.setItem('walletManuallyDisconnected', 'true');
        
        // Disconnect from WalletConnect
        disconnectWalletConnect()
          .then(() => {
            console.log('Successfully disconnected from WalletConnect');
          })
          .catch((error) => {
            console.error('Error disconnecting from WalletConnect:', error);
          })
          .finally(() => {
            // Reset wallet state regardless of disconnect success
            resetState();
            localStorage.removeItem('walletConnectionActive');
            resetProvider();
            resolve();
          });
      } else {
        // For other wallet providers
        resetState();
        localStorage.removeItem('walletConnectionActive');
        resolve();
      }
    });
  };

  if (!account) {
    return (
      <div className="relative mr-4" ref={menuRef}>
        <button
          disabled={connecting}
          onClick={() => {
            console.log("Connect Wallet button clicked");
            
            // Reset UI state
            setConnecting(true);
            
            // Use a more robust approach to ensure disconnection first
            if (localStorage.getItem('walletConnectionActive') === 'true') {
              handleDisconnect().finally(() => {
                // Ensure provider state is reset
                resetProvider();
                
                // Small delay to ensure disconnection is complete
                setTimeout(() => {
                  // Try connecting
                  connectWallet('walletconnect').catch(error => {
                    console.error("Connect wallet error:", error);
                    // Show a friendly message to the user if the connection times out or fails
                    alert("WalletConnect connection failed. Please try again or use a different wallet.");
                  }).finally(() => {
                    setTimeout(() => setConnecting(false), 500);
                  });
                }, 500);
              });
            } else {
              // Ensure provider state is reset
              resetProvider();
              
              // Connect directly if not previously connected
              connectWallet('walletconnect').catch(error => {
                console.error("Connect wallet error:", error);
                // Show a friendly message to the user if the connection times out or fails
                alert("WalletConnect connection failed. Please try again or use a different wallet.");
              }).finally(() => {
                setTimeout(() => setConnecting(false), 500);
              });
            }
          }}
          className="flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-teal-400 hover:bg-gray-800 group"
        >
          <span className="group-hover:text-teal-300">
            {connecting ? "Connecting..." : "Connect Wallet"}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative mr-4" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-teal-400 hover:bg-gray-800 group"
      >
        <span className="group-hover:text-teal-300">{shortenAddress(account)}</span>
        <span className="text-xs text-teal-300">{getChainName()}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform ${menuOpen ? 'rotate-180' : ''} group-hover:text-teal-300`}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-60 rounded-md bg-gray-900 shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <div className="flex border-b border-gray-700">
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium group ${menuTab === 'networks' ? 'text-teal-400' : 'text-gray-300 hover:bg-gray-800'}`}
                onClick={() => setMenuTab('networks')}
              >
                <span className="group-hover:text-teal-300">Networks</span>
              </button>
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium group ${menuTab === 'accounts' ? 'text-teal-400' : 'text-gray-300 hover:bg-gray-800'}`}
                onClick={() => setMenuTab('accounts')}
              >
                <span className="group-hover:text-teal-300">Accounts</span>
              </button>
            </div>

            {menuTab === 'networks' && (
              <>
                <p className="px-4 py-2 text-xs text-gray-400">Current: {getChainName()}</p>
                {chains.map((chain) => (
                  <button
                    key={chain.id}
                    className={`flex w-full items-center text-left px-4 py-2 text-sm ${currentChain === chain.id ? 'bg-gray-800 text-teal-400 font-medium' : 'text-gray-300 hover:bg-gray-800 group'}`}
                    onClick={() => switchChain(chain.id)}
                  >
                    <div className="w-5 h-5 mr-2 flex items-center justify-center">
                      <img src={chain.iconUrl} alt={chain.name} className="w-4 h-4" />
                    </div>
                    <span className={currentChain === chain.id ? '' : 'group-hover:text-teal-300'}>{chain.name}</span>
                  </button>
                ))}
              </>
            )}

            {menuTab === 'accounts' && (
              <>
                <p className="px-4 py-2 text-xs text-gray-400">Current: {shortenAddress(account)}</p>
                {accounts.length > 0 ? (
                  accounts.map((addr) => (
                    <button
                      key={addr}
                      className={`block w-full text-left px-4 py-2 text-sm ${account === addr ? 'bg-gray-800 text-gray-300 font-medium' : 'text-gray-300 hover:bg-gray-800 group'}`}
                      onClick={() => switchAccount(addr)}
                    >
                      <span className="group-hover:text-teal-300">{shortenAddress(addr)}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-2 text-sm text-gray-400">No additional accounts found</p>
                )}
                {walletProvider !== 'walletconnect' && (
                  <button
                    className="block w-full text-left px-4 py-2 text-sm text-teal-400 font-medium border-t border-gray-700 hover:bg-gray-800 hover:text-teal-300"
                    onClick={(e) => {
                      // Open wallet to add/connect account
                      window.ethereum?.request({
                        method: 'wallet_requestPermissions',
                        params: [{ eth_accounts: {} }]
                      });
                    }}
                  >
                    Connect New Account
                  </button>
                )}
              </>
            )}

            <button
              className="block w-full text-left px-4 py-2 text-sm text-red-400 font-medium border-t border-gray-700 hover:bg-gray-800 hover:text-red-300"
              onClick={(e) => {
                e.preventDefault(); 
                e.stopPropagation();
                console.log("Disconnect button clicked");
                handleDisconnect();
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 