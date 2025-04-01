// TypeScript declaration for window.ethereum
interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    isCoinbaseWallet?: boolean;
    isBraveWallet?: boolean;
    request: (request: { method: string; params?: any[] }) => Promise<any>;
    on: (eventName: string, callback: any) => void;
    chainId?: string;
    disconnect?: () => void; // Some wallet providers have this
  };
} 