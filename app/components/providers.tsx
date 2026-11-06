"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createConfig, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { hedera, hederaTransport } from "@/lib/chain";

export const wagmiConfig = createConfig({
  chains: [hedera],
  connectors: [injected()],
  transports: { [hedera.id]: hederaTransport },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        // Keep polling when the tab is in the background: the demo runs several roles side by side.
        defaultOptions: { queries: { staleTime: 2_000, refetchIntervalInBackground: true } },
      }),
  );
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
