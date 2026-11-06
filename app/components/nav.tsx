"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBalance, useConnect, useConnection, useConnectors, useDisconnect, useReadContract, useSwitchChain } from "wagmi";
import { formatUnits } from "viem";
import { testUsdAbi } from "@/lib/abi";
import { APP_NAME } from "@/lib/brand";
import { addresses, hedera } from "@/lib/chain";
import { short } from "@/lib/format";

const tabs = [
  { href: "/business", label: "Business" },
  { href: "/buyer", label: "Buyer" },
  { href: "/invest", label: "Invest" },
  { href: "/ops", label: "Operations" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-separator bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold">
          <span className="grid size-7 place-items-center rounded-[7px] bg-tint text-[13px] font-bold text-white">B</span>
          <span className="hidden sm:inline">{APP_NAME}</span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[15px] ${path.startsWith(t.href) ? "bg-fill font-semibold" : "text-secondary"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <Wallet />
      </div>
    </header>
  );
}

function Wallet() {
  const { address, status, chainId } = useConnection();
  const { mutate: switchChain, isPending: switching } = useSwitchChain();
  const connectors = useConnectors();
  const { mutate: connect, isPending } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const { data: hbar } = useBalance({ address, chainId: hedera.id, query: { enabled: !!address, refetchInterval: 10_000 } });
  const { data: tusd } = useReadContract({
    address: addresses.testUsd,
    abi: testUsdAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: hedera.id,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  if (status !== "connected" || !address) {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={() => connectors[0] && connect({ connector: connectors[0] })}
        className="h-8 shrink-0 rounded-full bg-tint px-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
      >
        Connect
      </button>
    );
  }
  if (chainId !== hedera.id) {
    return (
      <button
        type="button"
        disabled={switching}
        onClick={() => switchChain({ chainId: hedera.id })}
        className="h-8 shrink-0 rounded-full bg-[#ff9500] px-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
      >
        Switch to Hedera
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => disconnect()}
      title="Disconnect"
      className="flex h-8 shrink-0 items-center gap-2 rounded-full bg-fill px-3 text-[13px]"
    >
      <span className="hidden text-secondary md:inline">
        {tusd !== undefined ? `${Number(formatUnits(tusd, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 })} tUSD` : ""}
        {hbar ? ` · ${Number(formatUnits(hbar.value, 18)).toFixed(1)} HBAR` : ""}
      </span>
      <span className="font-mono">{short(address)}</span>
    </button>
  );
}
