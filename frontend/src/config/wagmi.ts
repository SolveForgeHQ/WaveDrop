import { http, createConfig } from "wagmi";
import { avalanche, avalancheFuji } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const config = createConfig({
  chains: [avalancheFuji, avalanche],
  connectors: [
    injected(),                                    // MetaMask / Core Wallet / browser wallets
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [avalanche.id]:    http(process.env.NEXT_PUBLIC_AVALANCHE_RPC ?? undefined),
    [avalancheFuji.id]: http(process.env.NEXT_PUBLIC_FUJI_RPC     ?? undefined),
  },
});

export const SUPPORTED_CHAINS = [avalancheFuji, avalanche] as const;
export const DEFAULT_CHAIN    = avalancheFuji;
