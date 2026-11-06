"use client";

import { useState } from "react";
import { erc20Abi, parseUnits, zeroAddress } from "viem";
import { useConnection, useReadContract, useReadContracts } from "wagmi";
import { CoinsIcon, ShieldIcon } from "@/components/icons";
import { RunLog } from "@/components/run-log";
import { Button, Choices, Empty, ErrorText, Field, Grade, IconSquare, inputClass, Page, Progress, Row, Section } from "@/components/ui";
import { dealManagerAbi, testUsdAbi } from "@/lib/abi";
import { addresses, hedera, links } from "@/lib/chain";
import { date, pct, relative, short, usd, yieldPa } from "@/lib/format";
import { api, errorMessage, useApi, useHederaWrite, useNow, useRefresh } from "@/lib/hooks";
import type { DealView } from "@/lib/server/hedera";
import type { Investor } from "@/lib/server/store";

const COUNTRIES = [
  { value: "IN", label: "India" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "SG", label: "Singapore" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
];

export default function InvestPage() {
  const { address } = useConnection();
  const { data: deals } = useApi<DealView[]>("/api/deals");
  const { data: verified } = useReadContract({
    address: addresses.dealManager,
    abi: dealManagerAbi,
    functionName: "isVerified",
    args: address ? [address] : undefined,
    chainId: hedera.id,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });
  const now = useNow();
  // Past their due date, open deals can only be closed and refunded.
  const open = deals?.filter((d) => d.status === "Open" && d.dueDate > now) ?? [];

  return (
    <Page title="Invest" subtitle="Fund verified bills from Indian businesses. Each deal is its own bond on Hedera; you are repaid the bill's face value when the buyer pays.">
      {!address ? (
        <Section>
          <Empty>Connect a wallet to invest</Empty>
        </Section>
      ) : (
        <>
          <Verification verified={verified === true} />
          <WalletSection />
        </>
      )}

      <Section header="Open deals" footer="Units are issued 1:1 for test USD and only verified wallets can hold them.">
        {!deals && <Empty>Loading</Empty>}
        {deals && open.length === 0 && <Empty>No deals open right now</Empty>}
        {open.map((d) => (
          <DealRow key={d.id} deal={d} canInvest={verified === true} />
        ))}
      </Section>

      {address && deals && <Portfolio deals={deals} />}
    </Page>
  );
}

function Verification({ verified }: { verified: boolean }) {
  const { address } = useConnection();
  const { data: app } = useApi<Investor | null>(address ? `/api/investors/${address}` : null, 3_000);
  const refresh = useRefresh();
  const [name, setName] = useState("");
  const [pan, setPan] = useState("");
  const [country, setCountry] = useState("IN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kyc = app?.kyc;

  if (verified) {
    return (
      <Section header="Verification">
        <Row
          icon={
            <IconSquare tone="green">
              <ShieldIcon />
            </IconSquare>
          }
          title="Verified on Hedera"
          subtitle="Every deal's bond accepts this wallet"
          detail={app?.name}
        />
      </Section>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/investors/${address}`, { method: "POST", body: { name, pan, country } });
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const running = kyc?.status === "running";
  const waitingForHedera = kyc?.status === "verified";

  return (
    <>
      <Section header="Verification" footer="Chainlink CRE checks your details with the KYC provider and marks this wallet verified on Hedera. Your PAN stays off chain.">
        <Field label="Full name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="As on PAN" />
        </Field>
        <Field label="PAN">
          <input className={`${inputClass} uppercase`} value={pan} onChange={(e) => setPan(e.target.value)} placeholder="ABCPE1234F" maxLength={10} />
        </Field>
        {kyc && kyc.runId && <RunLog runId={kyc.runId} />}
        {kyc?.status === "rejected" && <ErrorText error={`Not verified: ${kyc.reasons?.join("; ")}`} />}
        {waitingForHedera && (
          <div className="px-4 py-3 text-[13px] text-secondary">Approved. Waiting for the verification to reach Hedera over CCIP.</div>
        )}
      </Section>
      <Section header="Country of residence">
        <Choices options={COUNTRIES} value={country} onChange={setCountry} />
      </Section>
      <Button loading={busy || running} disabled={!name || pan.length !== 10 || waitingForHedera} onClick={submit}>
        Verify with Chainlink CRE
      </Button>
      <ErrorText error={error} />
    </>
  );
}

function WalletSection() {
  const { address } = useConnection();
  const write = useHederaWrite();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: balance } = useReadContract({
    address: addresses.testUsd,
    abi: testUsdAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: hedera.id,
    query: { enabled: !!address, refetchInterval: 8_000 },
  });

  const faucet = async () => {
    setBusy(true);
    setError(null);
    try {
      await write({ address: addresses.testUsd, abi: testUsdAbi, functionName: "faucet", args: [], gas: 120_000n });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section header="Wallet" footer="Test USD stands in for USDC on Hedera testnet.">
      <Row
        icon={
          <IconSquare tone="blue">
            <CoinsIcon />
          </IconSquare>
        }
        title={balance !== undefined ? usd(balance) : "…"}
        subtitle="Test USD"
        detail={
          <Button small variant="secondary" loading={busy} onClick={faucet}>
            Get 1,000
          </Button>
        }
      />
      <ErrorText error={error} />
    </Section>
  );
}

function DealRow({ deal, canInvest }: { deal: DealView; canInvest: boolean }) {
  const { address } = useConnection();
  const write = useHederaWrite();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();
  const remaining = BigInt(deal.target) - BigInt(deal.funded);
  const tenorDays = (deal.dueDate - now) / 86_400;
  const { data: allowance } = useReadContract({
    address: addresses.testUsd,
    abi: testUsdAbi,
    functionName: "allowance",
    args: address ? [address, addresses.dealManager] : undefined,
    chainId: hedera.id,
    query: { enabled: !!address },
  });

  const invest = async () => {
    setBusy(true);
    setError(null);
    try {
      const units = parseUnits(amount, 6);
      if (units <= 0n || units > remaining) throw new Error(`Enter up to ${usd(remaining)}`);
      if ((allowance ?? 0n) < units) {
        await write({ address: addresses.testUsd, abi: testUsdAbi, functionName: "approve", args: [addresses.dealManager, units], gas: 120_000n });
      }
      await write({ address: addresses.dealManager, abi: dealManagerAbi, functionName: "invest", args: [BigInt(deal.id), units], gas: 1_000_000n });
      setAmount("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="py-1">
      <Row
        icon={<Grade grade={deal.grade} />}
        title={deal.description ?? deal.ref}
        subtitle={`${deal.ref} · ${deal.seller ?? short(deal.business)} to ${deal.buyer ?? "buyer"}`}
        detail={
          <div>
            <div className="text-[17px] font-semibold text-label">
              {tenorDays >= 1 ? `${pct(yieldPa(deal.discountBps, now, deal.dueDate))} p.a.` : `${(deal.discountBps / 100).toFixed(2)}%`}
            </div>
            <div className="text-[13px]">matures {relative(deal.dueDate)}</div>
          </div>
        }
      />
      <div className="flex flex-col gap-2 px-4 pb-3 pl-[58px]">
        <Progress value={Number(BigInt(deal.funded) * 1000n / BigInt(deal.target)) / 1000} />
        <div className="flex justify-between text-[13px] text-secondary">
          <span>
            {usd(deal.funded)} of {usd(deal.target)}
          </span>
          <span>
            pays {usd(deal.faceValue)} on {date(deal.dueDate)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 flex-1 items-center rounded-full bg-fill px-3">
            <span className="text-secondary">$</span>
            <input
              className="min-w-0 flex-1 bg-transparent px-1 text-[15px] outline-none"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={(Number(remaining) / 1e6).toFixed(2)}
            />
            <button type="button" className="text-[13px] text-tint" onClick={() => setAmount((Number(remaining) / 1e6).toFixed(6).replace(/\.?0+$/, ""))}>
              Max
            </button>
          </div>
          <Button small loading={busy} disabled={!canInvest || !amount} onClick={invest}>
            Invest
          </Button>
        </div>
        {!canInvest && address && <div className="text-[13px] text-secondary">Verify your wallet to invest</div>}
        <a className="text-[13px] text-tint" href={links.hashscanContract(deal.bond)} target="_blank" rel="noreferrer">
          ATS bond {short(deal.bond)} on HashScan
        </a>
        <ErrorText error={error} />
      </div>
    </div>
  );
}

function Portfolio({ deals }: { deals: DealView[] }) {
  const { address } = useConnection();
  const bonds = deals.filter((d) => d.bond !== zeroAddress);
  const { data: balances } = useReadContracts({
    contracts: bonds.map((d) => ({
      address: d.bond as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address!] as const,
      chainId: hedera.id,
    })),
    query: { enabled: !!address && bonds.length > 0, refetchInterval: 8_000 },
  });
  const held = bonds
    .map((d, i) => ({ deal: d, units: (balances?.[i]?.result as bigint | undefined) ?? 0n }))
    .filter((h) => h.units > 0n);

  return (
    <Section header="Your portfolio">
      {held.length === 0 && <Empty>No positions yet</Empty>}
      {held.map((h) => (
        <Position key={h.deal.id} deal={h.deal} units={h.units} />
      ))}
    </Section>
  );
}

function Position({ deal, units }: { deal: DealView; units: bigint }) {
  const write = useHederaWrite();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = BigInt(deal.target);
  const payout =
    deal.status === "Repaid" ? (units * BigInt(deal.repaidAmount)) / target : deal.status === "Expired" ? units : (units * BigInt(deal.faceValue)) / target;
  const redeemable = deal.status === "Repaid" || deal.status === "Expired";
  const state =
    deal.status === "Open"
      ? "Funding"
      : deal.status === "Active"
        ? `Earning · due ${relative(deal.dueDate)}`
        : deal.status === "Late" || deal.status === "Defaulted"
          ? `${deal.status}: transfers paused until the buyer pays`
          : deal.status === "Repaid"
            ? "Repaid · ready to redeem"
            : "Expired · refund ready";

  const redeem = async () => {
    setBusy(true);
    setError(null);
    try {
      await write({ address: addresses.dealManager, abi: dealManagerAbi, functionName: "redeem", args: [BigInt(deal.id)], gas: 450_000n });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Row
        icon={<Grade grade={deal.grade} />}
        title={deal.description ?? deal.ref}
        subtitle={state}
        detail={
          <div>
            <div className="text-label">{usd(payout)}</div>
            <div className="text-[13px]">{usd(units)} in</div>
          </div>
        }
      />
      {redeemable && (
        <div className="px-4 pb-3 pl-[58px]">
          <Button small loading={busy} onClick={redeem}>
            Redeem {usd(payout)}
          </Button>
          <ErrorText error={error} />
        </div>
      )}
    </div>
  );
}
