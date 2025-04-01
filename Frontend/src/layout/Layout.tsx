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

    useEffect(() => {
        // Check if wallet is already connected on component mount
        const checkConnection = async () => {
            if (window.ethereum) {
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
                    }
                } catch (error) {
                    console.error("Error checking connection:", error);
                }
            }
        };

        checkConnection();

        // Listen for account changes
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (walletAccounts: string[]) => {
                setAccounts(walletAccounts);
                if (walletAccounts.length > 0) {
                    setAccount(walletAccounts[0]);
                } else {
                    setAccount(null);
                    setCurrentWallet(null);
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

    const connectWallet = async (walletId = 'metamask') => {
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
            const walletAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            setAccounts(walletAccounts);
            setAccount(walletAccounts[0]);
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            setCurrentChain(chainId);

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

    const disconnectWallet = () => {
        setAccount(null);
        setAccounts([]);
        setCurrentChain(null);
        setCurrentWallet(null);
        setMenuOpen(false);
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

    if (!account) {
        return (
            <div className="relative mr-4" ref={menuRef}>
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 rounded-md bg-blue-high px-3 py-2 text-sm font-medium text-white hover:bg-blue-high/80"
                >
                    Connect Wallet
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                    >
                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>

                {menuOpen && (
                    <div className="absolute right-0 mt-2 w-60 rounded-md bg-grey-low shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                        <div className="py-1">
                            <p className="px-4 py-2 text-sm font-medium border-b border-gray-200 text-gray-700">Select Wallet</p>
                            {wallets.map((wallet) => (
                                <button
                                    key={wallet.id}
                                    className="flex w-full items-center text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                                    onClick={() => connectWallet(wallet.id)}
                                >
                                    <div className="w-6 h-6 mr-2 flex items-center justify-center text-blue-high">
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                            <path d={wallet.icon} />
                                        </svg>
                                    </div>
                                    {wallet.name}
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
                className="flex items-center gap-2 rounded-md bg-blue-high px-3 py-2 text-sm font-medium text-white hover:bg-blue-high/80"
            >
                <span>{shortenAddress(account)}</span>
                <span className="text-xs opacity-70">{getChainName()}</span>
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                >
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </button>

            {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-md bg-grey-low shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                        <div className="flex border-b border-gray-200">
                            <button
                                className={`flex-1 px-4 py-2 text-sm font-medium ${menuTab === 'networks' ? 'text-blue-high' : 'text-gray-700'}`}
                                onClick={() => setMenuTab('networks')}
                            >
                                Networks
                            </button>
                            <button
                                className={`flex-1 px-4 py-2 text-sm font-medium ${menuTab === 'accounts' ? 'text-blue-high' : 'text-gray-700'}`}
                                onClick={() => setMenuTab('accounts')}
                            >
                                Accounts
                            </button>
                        </div>

                        {menuTab === 'networks' && (
                            <>
                                <p className="px-4 py-2 text-xs text-gray-500">Current: {getChainName()}</p>
                                {chains.map((chain) => (
                                    <button
                                        key={chain.id}
                                        className={`block w-full text-left px-4 py-2 text-sm ${currentChain === chain.id ? 'bg-blue-high/10 text-blue-high font-medium' : 'text-gray-700 hover:bg-gray-200'}`}
                                        onClick={() => switchChain(chain.id)}
                                    >
                                        {chain.name}
                                    </button>
                                ))}
                            </>
                        )}

                        {menuTab === 'accounts' && (
                            <>
                                <p className="px-4 py-2 text-xs text-gray-500">Current: {shortenAddress(account)}</p>
                                {accounts.length > 0 ? (
                                    accounts.map((addr) => (
                                        <button
                                            key={addr}
                                            className={`block w-full text-left px-4 py-2 text-sm ${account === addr ? 'bg-blue-high/10 text-blue-high font-medium' : 'text-gray-700 hover:bg-gray-200'}`}
                                            onClick={() => switchAccount(addr)}
                                        >
                                            {shortenAddress(addr)}
                                        </button>
                                    ))
                                ) : (
                                    <p className="px-4 py-2 text-sm text-gray-500">No additional accounts found</p>
                                )}
                                <button
                                    className="block w-full text-left px-4 py-2 text-sm text-blue-high font-medium border-t border-gray-200 hover:bg-gray-200"
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
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 border-t border-gray-200 hover:bg-gray-200 mt-2"
                            onClick={disconnectWallet}
                        >
                            Disconnect
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
