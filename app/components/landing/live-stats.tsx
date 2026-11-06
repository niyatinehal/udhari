"use client";

import { inr } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { DealView } from "@/lib/server/hedera";

/** What has actually happened on Hedera testnet, read live. */
export function LiveStats() {
  const { data: deals } = useApi<DealView[]>("/api/deals", 15_000);
  const funded = deals?.filter((d) => ["Active", "Repaid", "Late", "Defaulted"].includes(d.status)) ?? [];
  // What businesses received: each bill less its discount.
  const paid = funded.reduce((sum, d) => sum + Math.round(((d.amountPaise ?? 0) * (10_000 - d.discountBps)) / 10_000), 0);
  const repaid = deals?.filter((d) => d.status === "Repaid").length ?? 0;

  if (!deals) return <div className="h-5 w-80 animate-pulse rounded-full bg-fill" aria-hidden />;
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-secondary">
      <span className="inline-flex items-center gap-2">
        <span className="size-2 rounded-full bg-[#34c759]" aria-hidden />
        Live on Hedera testnet
      </span>
      <span aria-hidden className="hidden sm:inline">·</span>
      <span>
        <b className="font-semibold text-label">{funded.length}</b> invoices funded
      </span>
      <span aria-hidden className="hidden sm:inline">·</span>
      <span>
        <b className="font-semibold text-label">{inr(paid)}</b> paid to businesses
      </span>
      <span aria-hidden className="hidden sm:inline">·</span>
      <span>
        <b className="font-semibold text-label">{repaid}</b> paid back in full
      </span>
    </p>
  );
}
