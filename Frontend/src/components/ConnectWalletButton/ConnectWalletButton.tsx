import React, { useState, useEffect, useCallback, useRef } from "react";
import { chains } from "../../types/chains";
import { walletProviders } from "../../types/wallet-providers";

/**
 * A standalone wallet connection component that handles connecting to
 * and managing Ethereum wallet providers like MetaMask, Coinbase, and Brave
 */
export function ConnectWalletButton(): JSX.Element {
  const [account, setAccount] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [currentChain, setCurrentChain] = useState<string | null>(null);
  const [currentWallet, setCurrentWallet] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTab, setMenuTab] = useState<'networks' | 'accounts'>('networks');
  const menuRef = useRef<HTMLDivElement>(null);

  // Define disconnectWallet using useCallback to avoid dependency issues
  const disconnectWallet = useCallback(() => {
    // Reset all state variables to their initial values
    setAccount(null);
    setAccounts([]);
    setCurrentChain(null);
    setCurrentWallet(null);
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

  useEffect(() => {
    // Check if wallet is already connected on component mount
    const checkConnection = async () => {
      // Skip reconnection if manually disconnected
      if (localStorage.getItem('walletManuallyDisconnected') === 'true') {
        return;
      }
      
      // Only check for existing connections if we have previously established a connection
      // This prevents addresses from showing up before explicit user approval
      const hasExistingConnection = localStorage.getItem('walletConnectionActive') === 'true';
      
      if (window.ethereum && hasExistingConnection) {
        try {
          const walletAccounts = await window.ethereum.request({ method: 'eth_accounts' });
          setAccounts(walletAccounts);
          if (walletAccounts.length > 0) {
            setAccount(walletAccounts[0]);
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            setCurrentChain(chainId);
            
            // Detect current wallet using provider detection functions
            for (const provider of walletProviders) {
              if (provider.detectInstalled()) {
                setCurrentWallet(provider.id);
                break;
              }
            }
            // Default to MetaMask if we can't detect the wallet but ethereum is available
            if (!currentWallet && window.ethereum) {
              setCurrentWallet('metamask');
            }
          } else {
            // No accounts found even though we had a previous connection
            // Clear the connection flag
            localStorage.removeItem('walletConnectionActive');
          }
        } catch (error) {
          console.error("Error checking connection:", error);
          // On error, clear the connection flag
          localStorage.removeItem('walletConnectionActive');
        }
      }
    };
    
    checkConnection();

    // Listen for account changes only if not manually disconnected
    if (window.ethereum && localStorage.getItem('walletManuallyDisconnected') !== 'true') {
      window.ethereum.on('accountsChanged', (walletAccounts: string[]) => {
        setAccounts(walletAccounts);
        if (walletAccounts.length > 0) {
          setAccount(walletAccounts[0]);
          // Set connection as active since user has approved accounts
          localStorage.setItem('walletConnectionActive', 'true');
        } else {
          setAccount(null);
          setCurrentWallet(null);
          // Clear connection flag when all accounts are disconnected
          localStorage.removeItem('walletConnectionActive');
        }
      });

      // Listen for chain changes
      window.ethereum.on('chainChanged', (chainId: string) => {
        setCurrentChain(chainId);
      });
    }

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
  }, [currentWallet]);

  useEffect(() => {
    // This effect will run when account changes to null (disconnect)
    // Skip automatic reconnection if manually disconnected
    if (localStorage.getItem('walletManuallyDisconnected') === 'true') {
      return; // Exit early to prevent automatic reconnection
    }

    const checkIfStillConnected = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length === 0 && account !== null) {
            // We were connected but now we're not
            setAccount(null);
            setAccounts([]);
            setCurrentChain(null);
            setCurrentWallet(null);
            setMenuOpen(false);
            setMenuTab('networks');

            // Clear stored wallet data
            try {
              localStorage.removeItem('walletconnect');
              localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE');
            } catch (e) {
              console.error("Error clearing storage:", e);
            }
          }
        } catch (error) {
          console.error("Error checking connection status:", error);
        }
      }
    };

    // Check initially and set up interval to check periodically
    let interval: number | null = null;

    // Only set up the interval if not manually disconnected
    if (localStorage.getItem('walletManuallyDisconnected') !== 'true') {
      checkIfStillConnected();
      interval = window.setInterval(checkIfStillConnected, 3000) as unknown as number;
    }

    return () => {
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [account]);

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
    setCurrentWallet(providerId);
    
    try {
      // Check if provider is installed
      if (!provider.detectInstalled()) {
        // Open the install URL in a new tab
        window.open(provider.installUrl, '_blank');
        setConnecting(false);
        return;
      }
      
      // Request connection from the provider
      if (provider.requestConnection) {
        const walletAccounts = await provider.requestConnection();
        if (walletAccounts && walletAccounts.length > 0) {
          setAccounts(walletAccounts);
          setAccount(walletAccounts[0]);
          
          // Get the current chain ID
          if (window.ethereum) {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            setCurrentChain(chainId);
          }
          
          // Set connection as active since user has explicitly approved
          localStorage.setItem('walletConnectionActive', 'true');
        }
      } else {
        // Fallback for providers without specific connection method
        if (!window.ethereum) {
          console.error("No ethereum provider available");
          setConnecting(false);
          return;
        }
        
        const walletAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccounts(walletAccounts);
        setAccount(walletAccounts[0]);
        
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        setCurrentChain(chainId);
        
        // Set connection as active since user has explicitly approved
        localStorage.setItem('walletConnectionActive', 'true');
      }
      
      // Update current wallet detection
      for (const p of walletProviders) {
        if (p.detectInstalled()) {
          setCurrentWallet(p.id);
          break;
        }
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setCurrentWallet(null);
    } finally {
      setConnecting(false);
      setMenuOpen(false);
    }
  };

  const switchAccount = (newAccount: string) => {
    if (newAccount === account) return;

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

  const switchChain = async (chainId: string) => {
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

  const shortenAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getChainName = () => {
    if (!currentChain) return "";
    const chain = chains.find(c => c.id === currentChain);
    return chain ? chain.name : "Unknown Chain";
  };

  // Reset function that handles disconnection
  const handleDisconnect = () => {
    console.log("Disconnecting wallet...");

    // Set flag to prevent auto-reconnection
    localStorage.setItem('walletManuallyDisconnected', 'true');
    // Clear active connection flag
    localStorage.removeItem('walletConnectionActive');

    // Force immediate UI reset first
    setAccount(null);
    setAccounts([]);
    setCurrentChain(null);
    setCurrentWallet(null);
    setMenuOpen(false);
    setMenuTab('networks');

    // Clear any stored wallet connection data
    try {
      localStorage.removeItem('walletconnect');
      localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE');
      localStorage.removeItem('wagmi.store');
      localStorage.removeItem('wagmi.wallet');
      localStorage.removeItem('wagmi.connected');
      localStorage.removeItem('walletConnectionActive');

      // Clear session storage as well
      sessionStorage.clear();

      // Some wallets expose a disconnect method
      if (window.ethereum && window.ethereum.disconnect) {
        try {
          window.ethereum.disconnect();
        } catch (e) {
          console.log("No disconnect method available");
        }
      }

      // Try to remove event listeners if possible
      if (window.ethereum) {
        try {
          // @ts-ignore - TypeScript might complain but some wallets support this
          window.ethereum.removeAllListeners?.('accountsChanged');
          // @ts-ignore
          window.ethereum.removeAllListeners?.('chainChanged');
        } catch (e) {
          console.log("Could not remove wallet listeners");
        }
      }

      // Only check if wallet is really disconnected in extreme cases
      // where wallet still shows connected after 1 second
      let checkDisconnectionTimeout: number | null = null;

      checkDisconnectionTimeout = window.setTimeout(() => {
        if (window.ethereum) {
          window.ethereum.request({ method: 'eth_accounts' }).then((accounts: any) => {
            // If we still have accounts after 1 second, only then consider a page reload
            if (accounts && accounts.length > 0) {
              console.log("Wallet didn't disconnect after 1 second, consider clicking disconnect again");
              // Don't auto-reload anymore, let user manually disconnect
              // window.location.reload();
            }
          }).catch(() => {
            // Don't reload on error
            console.log("Error checking accounts after disconnect");
          });
        }
      }, 1000) as unknown as number;

      // Don't return anything - this would cause React hook rules violation
    } catch (error) {
      console.error("Error clearing wallet connection data:", error);
      // Don't force page reloads anymore
    }
  };

  if (!account) {
    return (
      <div className="relative mr-4" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-teal-400 hover:bg-gray-800 group"
        >
          <span className="group-hover:text-teal-300">Connect Wallet</span>
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
              <p className="px-4 py-2 text-sm font-medium border-b border-gray-700 text-teal-300">Select Wallet</p>
              {walletProviders.map((provider) => (
                <button
                  key={provider.id}
                  className="flex w-full items-center text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 group"
                  onClick={() => connectWallet(provider.id)}
                >
                  <div className="w-6 h-6 mr-2 flex items-center justify-center">
                    <img src={provider.iconUrl} alt={provider.name} className="w-5 h-5" />
                  </div>
                  <span className="group-hover:text-teal-300">{provider.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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