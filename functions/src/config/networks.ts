export interface NetworkConfig {
  name: string;
  chainId: string;
  symbol: string;
  decimals: number;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const networks: NetworkConfig[] = [
  {
    name: "Ethereum Mainnet",
    chainId: "0x1",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/",
    blockExplorerUrl: "https://etherscan.io",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  },
  {
    name: "Base",
    chainId: "0x2105",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: "https://base-mainnet.g.alchemy.com/v2/",
    blockExplorerUrl: "https://basescan.org",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  },
  {
    name: "Optimism",
    chainId: "0xa",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: "https://opt-mainnet.g.alchemy.com/v2/",
    blockExplorerUrl: "https://optimistic.etherscan.io",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  },
  {
    name: "Arbitrum One",
    chainId: "0xa4b1",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: "https://arb-mainnet.g.alchemy.com/v2/",
    blockExplorerUrl: "https://arbiscan.io",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  },
];
