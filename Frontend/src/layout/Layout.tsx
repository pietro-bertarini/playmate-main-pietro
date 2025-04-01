import React, { Component, useEffect, useState } from "react";
import "./styles.css";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BarLoader from "react-spinners/BarLoader";
import { Menu, Transition } from "@headlessui/react";
import { commonTransitionProps } from "components/PanelTransition";
import { NotificationsTarget } from "./Notifications";
import { Sidebar } from "./Sidebar";
import profileDownArrow from "assets/profile-down-arrow.svg";
import profileImg from "assets/profile.jpg";
import Hamburger from "assets/hamburger.svg";
import { useMenu } from "utils";
import * as icons from "./icons";

// Add TypeScript declaration for window.ethereum
// todo: Move this later
// This is needed to avoid TypeScript errors when using window.ethereum
declare global {
    interface Window {
        ethereum?: {
            isMetaMask?: boolean;
            isCoinbaseWallet?: boolean;
            isBraveWallet?: boolean;
            request: (request: { method: string; params?: any[] }) => Promise<any>;
            on: (eventName: string, callback: any) => void;
            chainId?: string;
            disconnect?: () => void;
        };
    }
}

// Chain configurations
const chains = [
    {
        id: "0x1",
        name: "Ethereum",
        rpcUrl: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
        currency: "ETH",
        blockExplorer: "https://etherscan.io"
    },
    {
        id: "0x89",
        name: "Polygon",
        rpcUrl: "https://polygon-rpc.com",
        currency: "MATIC",
        blockExplorer: "https://polygonscan.com"
    },
    {
        id: "0xa",
        name: "Optimism",
        rpcUrl: "https://mainnet.optimism.io",
        currency: "ETH",
        blockExplorer: "https://optimistic.etherscan.io"
    },
    {
        id: "0xa4b1",
        name: "Arbitrum",
        rpcUrl: "https://arb1.arbitrum.io/rpc",
        currency: "ETH",
        blockExplorer: "https://arbiscan.io"
    }
];

// Wallet options
const wallets = [
    {
        id: "metamask",
        name: "MetaMask",
        icon: "M13.7086 0L8.13807 4.59952L9.30083 2.04766L13.7086 0Z",
        detectProvider: () => window.ethereum?.isMetaMask
    },
    {
        id: "coinbase",
        name: "Coinbase Wallet",
        icon: "M12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0Z",
        detectProvider: () => window.ethereum?.isCoinbaseWallet
    },
    {
        id: "walletconnect",
        name: "WalletConnect",
        icon: "M6.08988 0H17.8851C21.6992 0 24.0001 2.30012 24.0001 6.11482V17.9097C24.0001 21.7248 21.6992 24.0001 17.8851 24.0001H6.08988C2.27572 24.0001 0 21.7248 0 17.9097V6.11482C0 2.30012 2.27572 0 6.08988 0Z",
        detectProvider: () => false // Need external provider for WalletConnect
    },
    {
        id: "brave",
        name: "Brave Wallet",
        icon: "M21.7 5.2L21.33 4.3C19.61 0.82 15.87 0 12 0C8.13 0 4.39 0.82 2.67 4.3L2.3 5.2C1.93 6.07 1.93 7 2.3 7.87L12 24L21.7 7.87C22.07 7 22.07 6.07 21.7 5.2Z",
        detectProvider: () => window.ethereum?.isBraveWallet
    }
];

// Simple Connect Wallet Button component
function ConnectWalletButton() {
    const [account, setAccount] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<string[]>([]);
    const [connecting, setConnecting] = useState(false);
    const [currentChain, setCurrentChain] = useState<string | null>(null);
    const [currentWallet, setCurrentWallet] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuTab, setMenuTab] = useState<'networks' | 'accounts'>('networks');
    const menuRef = React.useRef<HTMLDivElement>(null);

    // Define disconnectWallet using useCallback to avoid dependency issues
    const disconnectWallet = React.useCallback(() => {
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

                        // Detect current wallet
                        for (const wallet of wallets) {
                            if (wallet.detectProvider && wallet.detectProvider()) {
                                setCurrentWallet(wallet.id);
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

    const connectWallet = async (walletId = 'metamask') => {
        // Clear the manual disconnect flag when user tries to connect again
        localStorage.removeItem('walletManuallyDisconnected');

        // Force disconnection of any existing wallet connection first
        if (account) {
            await handleDisconnect();
            // Short delay to ensure disconnection completes
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Check if we need to open an external wallet website
        if (!window.ethereum) {
            if (walletId === 'walletconnect') {
                // Open WalletConnect in a new tab
                window.open('https://walletconnect.com/', '_blank');
                return;
            }

            // For other wallets, provide installation link
            const walletUrls: Record<string, string> = {
                metamask: 'https://metamask.io/download/',
                coinbase: 'https://www.coinbase.com/wallet/downloads',
                brave: 'https://brave.com/download/'
            };

            window.open(walletUrls[walletId] || walletUrls.metamask, '_blank');
            return;
        }

        setConnecting(true);
        setCurrentWallet(walletId);

        try {
            // For different wallet providers, we need different approaches
            if (walletId === 'coinbase' && !window.ethereum.isCoinbaseWallet) {
                // If selecting Coinbase but not currently using it, open Coinbase website
                window.open('https://www.coinbase.com/wallet/downloads', '_blank');
                setConnecting(false);
                return;
            }

            if (walletId === 'brave' && !window.ethereum.isBraveWallet) {
                // If selecting Brave but not currently using it, open Brave website
                window.open('https://brave.com/download/', '_blank');
                setConnecting(false);
                return;
            }

            // Clear any existing permissions to force new provider selection
            if (walletId === 'metamask') {
                try {
                    // This forces MetaMask to show its popup
                    await window.ethereum.request({
                        method: 'wallet_requestPermissions',
                        params: [{ eth_accounts: {} }]
                    });
                } catch (error) {
                    console.error("Error requesting permissions:", error);
                }
            }

            // Request accounts access
            const walletAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            setAccounts(walletAccounts);
            setAccount(walletAccounts[0]);
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            setCurrentChain(chainId);

            // Set connection as active since user has explicitly approved
            localStorage.setItem('walletConnectionActive', 'true');

            // Update current wallet detection
            for (const wallet of wallets) {
                if (wallet.detectProvider && wallet.detectProvider()) {
                    setCurrentWallet(wallet.id);
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

            // Check if the wallet is still connected after our attempts
            setTimeout(() => {
                if (window.ethereum) {
                    window.ethereum.request({ method: 'eth_accounts' }).then((accounts: any) => {
                        console.log("After disconnect, accounts:", accounts);
                        // If we still have accounts, the wallet didn't disconnect properly
                        if (accounts && accounts.length > 0) {
                            console.log("Wallet didn't fully disconnect. Reloading page...");
                            window.location.reload();
                        }
                    }).catch(() => {
                        // If there's an error checking accounts, reload to be safe
                        window.location.reload();
                    });
                }
            }, 500);
        } catch (error) {
            console.error("Error clearing wallet connection data:", error);
            // Even if there's an error, try to reload the page
            setTimeout(() => window.location.reload(), 500);
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
                            {wallets.map((wallet) => (
                                <button
                                    key={wallet.id}
                                    className="flex w-full items-center text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 group"
                                    onClick={() => connectWallet(wallet.id)}
                                >
                                    <div className="w-6 h-6 mr-2 flex items-center justify-center text-teal-400">
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                            <path d={wallet.icon} />
                                        </svg>
                                    </div>
                                    <span className="group-hover:text-teal-300">{wallet.name}</span>
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
                                        className={`block w-full text-left px-4 py-2 text-sm ${currentChain === chain.id ? 'bg-gray-800 text-teal-400 font-medium' : 'text-gray-300 hover:bg-gray-800 group'}`}
                                        onClick={() => switchChain(chain.id)}
                                    >
                                        <span className="group-hover:text-teal-300">{chain.name}</span>
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
                                            className={`block w-full text-left px-4 py-2 text-sm ${account === addr ? 'bg-gray-800 text-teal-400 font-medium' : 'text-gray-300 hover:bg-gray-800 group'}`}
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
                                    onClick={() => {
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
                            className="block w-full text-left px-4 py-2 text-sm text-red-400 border-t border-gray-700 hover:bg-gray-800 group mt-2"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log("Disconnect button clicked");
                                handleDisconnect();
                            }}
                        >
                            <span className="group-hover:text-red-300">Disconnect</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function UserMenuContent() {
    const navigate = useNavigate();
    return (
        <>
            <Menu.Item
                as='li'
                className='flex cursor-pointer items-center gap-x-3.5 rounded-half px-4 py-3 hover:bg-blue-high/10'
                onClick={() => navigate("/settings")}
            >
                <icons.Settings />
                Settings
            </Menu.Item>
            <Menu.Item
                as='li'
                className='flex cursor-pointer items-center gap-x-3.5 rounded-half px-4 py-3 hover:bg-blue-high/10'
            >
                <icons.Help />
                Help
            </Menu.Item>
            <Menu.Item
                as='li'
                className='flex cursor-pointer items-center gap-x-3.5 rounded-half px-4 py-3 hover:bg-blue-high/10'
                onClick={() => {
                    window.localStorage.clear();
                    window.location.href = "../../login";
                }}
            >
                <icons.Logout />
                Log Out
            </Menu.Item>
        </>
    );
}

function UserMenuTarget({ children }: React.PropsWithChildren) {
    const m = useMenu();

    return (
        <Menu>
            <Menu.Button ref={e => m.setReferenceElem(e as any)}>
                {children}
            </Menu.Button>

            <Transition {...commonTransitionProps} className='z-[999999]'>
                <Menu.Items
                    ref={e => m.setFloatingElement(e as any)}
                    style={m.styles.popper}
                    {...m.attributes.popper}
                    as='ul'
                    className='z-[9999999] min-w-[15rem] overflow-hidden rounded-half bg-grey-low outline-none'
                >
                    <UserMenuContent />
                </Menu.Items>
            </Transition>
        </Menu>
    );
}

function UserProfile({userData} : any) {
    return (
        <>
            <UserMenuTarget>
                <p className='ml-8 box-content flex cursor-pointer select-none items-center rounded-md p-2 transition-colors hover:bg-blue-high/10'>
                    {userData.fname} {userData.lname}
                    <img className='ml-1' src={profileDownArrow} />
                </p>
            </UserMenuTarget>

            <UserMenuTarget>
                <img
                    className='ml-4 box-content h-7 w-7 cursor-pointer rounded-full p-2 transition-colors hover:bg-blue-high/10'
                    src={profileImg}
                />
            </UserMenuTarget>
        </>
    );
}

export function Layout() {
    let [open, setOpen] = React.useState(false);

    const [loaded, setLoaded] = useState(false);

    const [userData, setUserData] = useState("");
    const [events, setEvents] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);

    const [admin, setAdmin] = useState(false);

    useEffect(() => {
        fetch("http://127.0.0.1:5001/getUserData", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                token: window.localStorage.getItem("token"),
            }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.data.userType == "Admin") {
                    setAdmin(true);
                }

                setUserData(data.data);

                if (data.data == "token expired") {
                    if (window.location.pathname !== "/login") {
                        window.localStorage.clear();
                        window.location.href = "../../login";
                    }
                }

            });

    }, []);

    useEffect(() => {
        if(!userData) return;

        fetch("http://127.0.0.1:5001/getEvents", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                token: window.localStorage.getItem("token"),
                status: "Pending Invite"
            }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.data == "token expired") {
                    return;
                }
                setEvents(data.data);
            });
    }, [userData]);

    useEffect(() => {
        if(!events) return;

        fetch("http://127.0.0.1:5001/getFriendRequests", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                token: window.localStorage.getItem("token"),
            }),
        })
            .then((res) => res.json())
            .then((data) => {
                setLoaded(true);

                if (data.data == "token expired") {
                    return;
                }
                setFriendRequests(data.data);
            });
    }, [events]);

    return (
        <>
            {!loaded && (
                <BarLoader color="#5ce5e2"
                           cssOverride={{
                               display: "block",
                               margin: "10vh auto",
                               borderColor: "red",
                           }}
                />
            )}
            {loaded && (
                <>
                    <LayoutSidebar open={open} setOpen={setOpen} userData={userData} />
                    <ContentPane setOpen={setOpen} userData={userData} events={events} friendRequests={friendRequests} />
                </>
            )}
        </>
    );
}

function ContentPane({ setOpen, userData, events, friendRequests }: any) {
    const [title, setTitle] = React.useState<React.ReactNode>(null);
    const [actions, setActions] = React.useState<React.ReactNode>(null);
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        // Set type in events array to "eventInvite"
        events.forEach((event: any) => {
            event.type = "eventInvite";
        });

        // Set type in friend requests array to "friendRequest"
        friendRequests.forEach((friendRequest: any) => {
            friendRequest.type = "friendRequest";
        });

        // Combine events and friend requests into notifications array
        let notificationsTemp = events.concat(friendRequests);
        setNotifications(notificationsTemp)
    }, [events, friendRequests])

    return (
        <section className='flex max-h-full min-h-full min-w-0 max-w-full flex-1 flex-col overflow-y-auto overflow-x-hidden bg-sheet desktop:overflow-y-hidden'>
            <header className='flex flex-wrap items-center px-5 py-3'>
                <div className='flex items-center desktop:hidden'>
                    <button
                        className='mr-2 box-content rounded-md p-2 transition-colors hover:bg-blue-high/10'
                        onClick={() => setOpen(true)}
                    >
                        <img src={Hamburger} />
                    </button>
                    <h1 className='text-2xl font-extrabold text-blue-high'>LOGO</h1>
                </div>

                <div className='order-1 mt-0 flex w-full items-center justify-between desktop:order-none desktop:mt-0 desktop:w-auto'>
                    <h1 className='py-6 text-2xl font-bold desktop:py-0'>{title}</h1>
                    <div className='flex items-center gap-x-0.5 desktop:hidden'>
                        {actions}
                    </div>
                </div>

                <div className='flex flex-1 items-center justify-end'>
                    <ConnectWalletButton />
                    <NotificationsTarget notifications={notifications} setNotifications={setNotifications} />
                    <div className='hidden items-center desktop:flex'>
                        <UserProfile userData={userData} />
                    </div>
                </div>
            </header>

            <div className='min-h-0 min-w-0 flex-1 px-5 pt-0 desktop:overflow-y-auto desktop:pt-8 [&>:last-child]:mb-8'>
                <Outlet context={{ setTitle, setActions }} />
            </div>
        </section>
    );
}

function LayoutSidebar({ open, setOpen, userData }: any) {
    const location = useLocation();

    React.useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

    return (
        <>
            {open && (
                <div
                    className='fixed z-[3002] h-screen w-screen bg-black/30 desktop:hidden'
                    onClick={() => {
                        setOpen(false);
                    }}
                />
            )}
            <aside id='sidebar' className='self-stretch' data-app-open={open}>
                <Sidebar userData={userData} />
            </aside>
        </>
    );
}
