"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useBalance, useConnect, useConnection, useConnectors, useDisconnect, useReadContract, useSwitchChain } from "wagmi";
import { testUsdAbi } from "@/lib/abi";
import { APP_NAME } from "@/lib/brand";
import { addresses, hedera } from "@/lib/chain";
import { short } from "@/lib/format";

const tabs = [
  { href: "/business", label: "Business" },
  { href: "/buyer", label: "Buyer" },
  { href: "/invest", label: "Invest" },
  { href: "/ops", label: "Admin" },
];

const EASE = "transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint";
const DELAYS = ["delay-100", "delay-150", "delay-200", "delay-300", "delay-500"];

/** A floating glass island; on small screens it opens into a full screen menu. */
export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-6">
        <div className="pointer-events-auto flex h-12 w-max max-w-full items-center gap-1 rounded-full border border-separator bg-card/70 py-1 pl-2 pr-1 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          <Link href="/" onClick={() => setOpen(false)} className={`flex items-center gap-2 rounded-full pr-2 text-sm font-semibold ${FOCUS}`}>
            <span className="grid size-8 place-items-center rounded-full bg-tint text-sm font-bold text-white">{APP_NAME[0]}</span>
            {APP_NAME}
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            {tabs.map((t) => {
              const current = path.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={current ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-sm hover:bg-fill ${EASE} ${FOCUS} ${current ? "bg-fill font-semibold" : "text-secondary"}`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <Wallet />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className={`relative size-10 shrink-0 rounded-full hover:bg-fill sm:hidden ${FOCUS}`}
          >
            <span className={`absolute left-3 top-1/2 h-0.5 w-4 rounded-full bg-label ${EASE} ${open ? "rotate-45" : "-translate-y-1"}`} />
            <span className={`absolute left-3 top-1/2 h-0.5 w-4 rounded-full bg-label ${EASE} ${open ? "-rotate-45" : "translate-y-1"}`} />
          </button>
        </div>
      </header>

      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-30 flex flex-col justify-center gap-6 bg-white/80 px-8 backdrop-blur-3xl dark:bg-black/80 sm:hidden ${EASE} ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        {[{ href: "/", label: "Home" }, ...tabs].map((t, i) => (
          <div key={t.href} className="overflow-hidden">
            <Link
              href={t.href}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              aria-current={path === t.href || (t.href !== "/" && path.startsWith(t.href)) ? "page" : undefined}
              className={`block text-4xl font-semibold tracking-tight ${EASE} ${DELAYS[i]} ${FOCUS} ${open ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"} aria-[current=page]:text-tint`}
            >
              {t.label}
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}

function Wallet() {
  const { address, status, chainId } = useConnection();
  const { mutate: switchChain, isPending: switching } = useSwitchChain();
  const connectors = useConnectors();
  const { mutate: connect, isPending } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const { data: hbar } = useBalance({ address, chainId: hedera.id, query: { enabled: !!address, refetchInterval: 15_000 } });
  const { data: tusd } = useReadContract({
    address: addresses.testUsd,
    abi: testUsdAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: hedera.id,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });
  const pill = `h-10 shrink-0 rounded-full px-3 text-sm font-semibold active:scale-[0.98] disabled:opacity-50 ${EASE} ${FOCUS}`;

  if (status !== "connected" || !address) {
    return (
      <button type="button" disabled={isPending} onClick={() => connectors[0] && connect({ connector: connectors[0] })} className={`${pill} bg-tint text-white hover:opacity-90`}>
        Connect
      </button>
    );
  }
  if (chainId !== hedera.id) {
    return (
      <button type="button" disabled={switching} onClick={() => switchChain({ chainId: hedera.id })} className={`${pill} bg-[#ff9500] text-white hover:opacity-90`}>
        Switch to Hedera
      </button>
    );
  }
  return (
    <button type="button" onClick={() => disconnect()} title="Disconnect" className={`${pill} flex items-center gap-2 bg-fill font-normal hover:opacity-80`}>
      <span className="hidden text-secondary lg:inline">
        {tusd !== undefined ? `${Number(formatUnits(tusd, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 })} tUSD` : ""}
        {hbar ? ` · ${Number(formatUnits(hbar.value, 18)).toFixed(1)} HBAR` : ""}
      </span>
      <span className="font-mono">{short(address)}</span>
    </button>
  );
}
