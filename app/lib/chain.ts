import { defineChain, fallback, http } from "viem";

// Testnet deployments. Source of truth: contracts/deployments/testnet.json.
export const addresses = {
  dealManager: "0x19723Bc95eFc5b8153B80B2E44c72D40754A1b5b",
  testUsd: "0x9793ce270670a2cf1D72d80D3C6eAcBb4B420D9b",
  creRelay: "0xA074d972967c69BB5a0ae669e2d807b1744857b2",
  operator: "0x615a13517F257f8Fa160d9F5C2E8064a1D0858AF",
} as const;

const THIRDWEB = "https://296.rpc.thirdweb.com";
const HASHIO = "https://testnet.hashio.io/api";

// thirdweb first for wallets and the server: Hashio rate limits per IP, and wallets simulate and
// estimate every transaction through their RPC. A wallet adding Hedera here gets thirdweb.
export const hederaRpcUrls = [THIRDWEB, HASHIO];

export const hedera = defineChain({
  id: 296,
  name: "Hedera Testnet",
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: { default: { http: hederaRpcUrls } },
  blockExplorers: { default: { name: "HashScan", url: "https://hashscan.io/testnet" } },
  testnet: true,
});

/** Server-side reads and the operator's transactions. */
export const hederaTransport = fallback(hederaRpcUrls.map((url) => http(url)));

/** Browser reads. thirdweb's public endpoint rejects cross-origin requests without a client id. */
export const hederaBrowserTransport = http(HASHIO);

export const fujiRpcUrl = "https://api.avax-test.network/ext/bc/C/rpc";

export const links = {
  hashscanTx: (hash: string) => `https://hashscan.io/testnet/transaction/${hash}`,
  hashscanContract: (address: string) => `https://hashscan.io/testnet/contract/${address}`,
  hashscanToken: (address: string) => `https://hashscan.io/testnet/token/${address}`,
  snowtraceTx: (hash: string) => `https://testnet.snowtrace.io/tx/${hash}`,
  ccipTx: (hash: string) => `https://ccip.chain.link/tx/${hash}`,
  ccipMessage: (id: string) => `https://ccip.chain.link/msg/${id}`,
};

// Deal.status on chain.
export const dealStatus = [
  "None",
  "Approved",
  "Open",
  "Active",
  "Repaid",
  "Late",
  "Defaulted",
  "Expired",
] as const;
export type DealStatus = (typeof dealStatus)[number];

export const grades = ["A", "B", "C", "D", "E"] as const;
export const USD_DECIMALS = 6;
