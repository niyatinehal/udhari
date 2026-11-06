"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { Abi, ContractFunctionArgs, ContractFunctionName, Hex } from "viem";
import { useConnection, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { hedera } from "./chain";

export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `${res.status}`);
  return json as T;
}

/** Polls a JSON endpoint. */
export function useApi<T>(url: string | null, refetchInterval = 5_000) {
  return useQuery({
    queryKey: [url],
    queryFn: () => api<T>(url!),
    enabled: url !== null,
    refetchInterval,
  });
}

/** Refetches every query in the background. Not awaited: one slow RPC read must not hold a button busy. */
export function useRefresh() {
  const client = useQueryClient();
  return useCallback(() => {
    void client.invalidateQueries();
  }, [client]);
}

/** A value kept in localStorage, e.g. the company a wallet acts for. */
export function useStored(key: string): [string | null, (v: string) => void] {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    try {
      // Restores a saved choice after hydration; storage is not available during server render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(localStorage.getItem(key));
    } catch {
      // storage unavailable
    }
  }, [key]);
  const set = useCallback(
    (v: string) => {
      setValue(v);
      try {
        localStorage.setItem(key, v);
      } catch {
        // storage unavailable
      }
    },
    [key],
  );
  return [value, set];
}

type WriteArgs<abi extends Abi, fn extends ContractFunctionName<abi, "nonpayable" | "payable">> = {
  address: `0x${string}`;
  abi: abi;
  functionName: fn;
  args: ContractFunctionArgs<abi, "nonpayable" | "payable", fn>;
  gas: bigint;
};

/** Moves the wallet to Hedera testnet (adding the network if needed). Typed-data signatures and
 *  transactions both fail while the wallet sits on another chain. */
export function useEnsureHedera() {
  const { chainId } = useConnection();
  const { mutateAsync: switchChain } = useSwitchChain();
  return useCallback(async () => {
    if (chainId !== hedera.id) await switchChain({ chainId: hedera.id });
  }, [chainId, switchChain]);
}

/** Sends a Hedera transaction from the connected wallet and waits for it to succeed. */
export function useHederaWrite() {
  const ensureHedera = useEnsureHedera();
  const { mutateAsync: writeContract } = useWriteContract();
  const client = usePublicClient({ chainId: hedera.id });
  const refresh = useRefresh();

  return useCallback(
    async <const abi extends Abi, fn extends ContractFunctionName<abi, "nonpayable" | "payable">>(
      call: WriteArgs<abi, fn>,
    ): Promise<Hex> => {
      await ensureHedera();
      // wagmi's generic write signature cannot follow these generics; the call is checked above.
      const hash = await writeContract({ ...call, chainId: hedera.id } as never);
      const receipt = await client!.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success") throw new Error(`Transaction failed: ${hash}`);
      refresh();
      return hash;
    },
    [ensureHedera, writeContract, client, refresh],
  );
}

/** Current unix time in seconds, ticking so countdowns stay fresh. */
export function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export const errorMessage = (err: unknown) => {
  const e = err as { shortMessage?: string; message?: string };
  return (e.shortMessage ?? e.message ?? String(err)).split("\n")[0];
};
