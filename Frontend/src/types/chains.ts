// Chain configurations with support for external image URLs
export interface Chain {
  id: string;
  name: string;
  rpcUrl: string;
  currency: string;
  blockExplorer: string;
  iconUrl: string; // External URL for the chain's icon
}

export const chains: Chain[] = [
  {
    id: "0x1",
    name: "Ethereum",
    rpcUrl: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
    currency: "ETH",
    blockExplorer: "https://etherscan.io",
    iconUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=026"
  },
  {
    id: "0xa",
    name: "Optimism",
    rpcUrl: "https://mainnet.optimism.io",
    currency: "ETH",
    blockExplorer: "https://optimistic.etherscan.io",
    iconUrl: "https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg?v=026"
  },
];
