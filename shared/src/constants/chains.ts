/**
 * Avalanche chain configuration for wagmi / viem.
 */

export const AVALANCHE_MAINNET = {
  id: 43114,
  name: "Avalanche",
  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
  rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
  blockExplorerUrl: "https://snowtrace.io",
} as const;

export const AVALANCHE_FUJI = {
  id: 43113,
  name: "Avalanche Fuji Testnet",
  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
  rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
  blockExplorerUrl: "https://testnet.snowtrace.io",
} as const;

/**
 * USDC on Avalanche C-Chain (mainnet).
 * https://developers.circle.com/stablecoins/usdc-on-avalanche
 */
export const USDC_MAINNET_ADDRESS =
  "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6c" as const;

/** 6 decimals — same as all Circle USDC deployments */
export const USDC_DECIMALS = 6;

/**
 * Placeholder — replace with deployed address after running
 * `forge script contracts/script/Deploy.s.sol --rpc-url fuji --broadcast`
 */
export const WAVEDROP_DISTRIBUTOR_FUJI = "" as const;
export const WAVEDROP_DISTRIBUTOR_MAINNET = "" as const;
