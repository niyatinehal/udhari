"use client";

import { useState } from "react";
import { isAddressEqual } from "viem";
import { useConnection, useReadContract, useSignTypedData } from "wagmi";
import { CompanySection, useCompany } from "@/components/company";
import { CoinsIcon, PenIcon } from "@/components/icons";
import { Button, Empty, ErrorText, IconSquare, Page, Row, Section, Sheet } from "@/components/ui";
import { dealManagerAbi, testUsdAbi } from "@/lib/abi";
import { addresses, hedera } from "@/lib/chain";
import { confirmationDomain, confirmationMessage, confirmationTypes } from "@/lib/confirmation";
import { date, inr, relative, short, usd } from "@/lib/format";
import { api, errorMessage, useApi, useEnsureHedera, useHederaWrite, useRefresh } from "@/lib/hooks";
import type { DealView } from "@/lib/server/hedera";
import type { Bill } from "@/lib/server/store";

export default function BuyerPage() {
  const company = useCompany("buyer");
  const gstin = company.company?.gstin;
  const { address } = useConnection();
  const bound = !!(company.company?.wallet && address && isAddressEqual(company.company.wallet, address));
  const { data: bills } = useApi<Bill[]>(gstin ? `/api/bills?buyer=${gstin}` : null, 3_000);
  const { data: deals } = useApi<DealView[]>("/api/deals");
  const [reviewing, setReviewing] = useState<Bill | null>(null);

  const toConfirm = bills?.filter((b) => !b.confirmation) ?? [];
  const mine = deals?.filter((d) => d.buyerGstin === gstin) ?? [];
  const toPay = mine.filter((d) => ["Active", "Late", "Defaulted"].includes(d.status));
  const settled = mine.filter((d) => d.status === "Repaid");

  return (
    <Page title="Buyer" subtitle="Confirm bills your suppliers raise against you, and pay them when due. Confirming does not change your terms; it lets your supplier get paid early.">
      <CompanySection role="buyer" state={company} />

      {gstin && (
        <Section header="To confirm">
          {toConfirm.length === 0 && <Empty>Nothing waiting for you</Empty>}
          {toConfirm.map((b) => (
            <Row
              key={b.id}
              icon={
                <IconSquare tone="orange">
                  <PenIcon />
                </IconSquare>
              }
              title={b.ref}
              subtitle={`${b.seller.name} · due ${date(b.dueDate)}`}
              detail={inr(b.amountPaise)}
              onClick={bound ? () => setReviewing(b) : undefined}
              chevron={bound}
            />
          ))}
        </Section>
      )}

      {gstin && (
        <Section header="To pay" footer="Payment goes to the deal on Hedera; investors redeem from it.">
          {toPay.length === 0 && <Empty>No financed bills due</Empty>}
          {toPay.map((d) => (
            <PayRow key={d.id} deal={d} />
          ))}
        </Section>
      )}

      {settled.length > 0 && (
        <Section header="Paid">
          {settled.map((d) => (
            <Row key={d.id} title={d.ref} subtitle={`${d.seller} · paid ${relative(d.repaidAt)}`} detail={usd(d.repaidAmount)} />
          ))}
        </Section>
      )}

      <ConfirmSheet bill={reviewing} onClose={() => setReviewing(null)} />
    </Page>
  );
}

function ConfirmSheet({ bill, onClose }: { bill: Bill | null; onClose: () => void }) {
  const { address } = useConnection();
  const { mutateAsync: signTypedData } = useSignTypedData();
  const ensureHedera = useEnsureHedera();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!bill || !address) return;
    setBusy(true);
    setError(null);
    try {
      // The signature's domain names Hedera; wallets refuse to sign it from another chain.
      await ensureHedera();
      const signature = await signTypedData({
        domain: confirmationDomain,
        types: confirmationTypes,
        primaryType: "BillConfirmation",
        message: confirmationMessage(bill),
      });
      await api(`/api/bills/${bill.id}/confirm`, { method: "POST", body: { wallet: address, signature } });
      refresh();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!bill} onClose={onClose} title="Confirm bill">
      {bill && (
        <>
          <Section header="Terms you are confirming" footer="You sign these exact terms. Chainlink CRE checks your signature against your company's wallet before the bill is financed.">
            <Row title="Supplier" detail={bill.seller.name} />
            <Row title="Bill" detail={bill.ref} />
            <Row title="Work" detail={<span className="text-[15px]">{bill.description}</span>} />
            <Row title="Amount" detail={inr(bill.amountPaise)} />
            <Row title="You pay by" detail={date(bill.dueDate)} />
            <Row title="Document" detail={<span className="font-mono text-[13px]">{bill.fileHash.slice(0, 14)}…</span>} />
            <Row title="Paid to" detail={<span className="font-mono text-[13px]">{short(bill.seller.wallet)}</span>} />
          </Section>
          <Button loading={busy} onClick={confirm}>
            Sign and confirm
          </Button>
          <ErrorText error={error} />
        </>
      )}
    </Sheet>
  );
}

function PayRow({ deal }: { deal: DealView }) {
  const { address } = useConnection();
  const write = useHederaWrite();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const face = BigInt(deal.faceValue);
  const { data: balance } = useReadContract({
    address: addresses.testUsd,
    abi: testUsdAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: hedera.id,
    query: { enabled: !!address },
  });
  const { data: allowance } = useReadContract({
    address: addresses.testUsd,
    abi: testUsdAbi,
    functionName: "allowance",
    args: address ? [address, addresses.dealManager] : undefined,
    chainId: hedera.id,
    query: { enabled: !!address },
  });
  const short_ = balance !== undefined && balance < face;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const pay = () =>
    run("pay", async () => {
      if ((allowance ?? 0n) < face) {
        await write({ address: addresses.testUsd, abi: testUsdAbi, functionName: "approve", args: [addresses.dealManager, face], gas: 120_000n });
      }
      await write({ address: addresses.dealManager, abi: dealManagerAbi, functionName: "repay", args: [BigInt(deal.id)], gas: 400_000n });
    });

  const faucet = () => run("faucet", () => write({ address: addresses.testUsd, abi: testUsdAbi, functionName: "faucet", args: [], gas: 120_000n }));

  return (
    <div>
      <Row
        icon={
          <IconSquare tone={deal.status === "Active" ? "green" : "red"}>
            <CoinsIcon />
          </IconSquare>
        }
        title={deal.ref}
        subtitle={`${deal.seller} · ${deal.status === "Active" ? `due ${relative(deal.dueDate)}` : `${deal.status.toLowerCase()}, was due ${relative(deal.dueDate)}`}`}
        detail={usd(deal.faceValue)}
      />
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        <Button small loading={busy === "pay"} disabled={!address || short_ || !!busy} onClick={pay}>
          Pay {usd(deal.faceValue)}
        </Button>
        {short_ && (
          <Button small variant="secondary" loading={busy === "faucet"} disabled={!!busy} onClick={faucet}>
            Get 1,000 test USD
          </Button>
        )}
      </div>
      <ErrorText error={error} />
    </div>
  );
}
