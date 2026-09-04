/**
 * Stellar & Soroban network configuration.
 */

export const STELLAR_MAINNET = {
  name: "Stellar Mainnet",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
  horizonUrl: "https://horizon.stellar.org",
  sorobanRpcUrl: "https://mainnet.sorobanrpc.org",
  explorerUrl: "https://stellar.expert/explorer/public",
  usdcIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
} as const;

export const STELLAR_TESTNET = {
  name: "Stellar Testnet",
  networkPassphrase: "Test SDF Network ; September 2015",
  horizonUrl: "https://horizon-testnet.stellar.org",
  sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  explorerUrl: "https://stellar.expert/explorer/testnet",
  usdcIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
} as const;

export const STELLAR_FUTURENET = {
  name: "Stellar Futurenet",
  networkPassphrase: "Test SDF Future Network ; October 2022",
  sorobanRpcUrl: "https://rpc-futurenet.stellar.org",
  explorerUrl: "https://stellar.expert/explorer/futurenet",
} as const;

/**
 * 7 decimals for Stellar native assets / standard Stellar USDC (or 6 for standard SAC).
 */
export const STELLAR_USDC_DECIMALS = 7;
export const USDC_DECIMALS = 6;

/**
 * Deployed Soroban contract IDs (fill once deployed to Testnet/Mainnet).
 */
export const WAVEDROP_SOROBAN_CONTRACT_TESTNET = "" as const;
export const WAVEDROP_SOROBAN_CONTRACT_MAINNET = "" as const;
