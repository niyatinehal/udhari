"use client";

import { useState } from "react";
import { useConnection, useReadContract } from "wagmi";
import { CompanySection, useCompany } from "@/components/company";
import { CoinsIcon } from "@/components/icons";
import { Button, Empty, ErrorText, IconSquare, Page, Row, Section } from "@/components/ui";
import { dealManagerAbi, testUsdAbi } from "@/lib/abi";
import { addresses, hedera } from "@/lib/chain";
import { relative, usd } from "@/lib/format";
import { errorMessage, useApi, useHederaWrite } from "@/lib/hooks";
import type { DealView } from "@/lib/server/hedera";

export default function BuyerPage() {
  const company = useCompany("buyer");
  const gstin = company.company?.gstin;
  const { data: deals } = useApi<DealView[]>("/api/deals");

  const mine = deals?.filter((d) => d.buyerGstin === gstin) ?? [];
  const toPay = mine.filter((d) => ["Active", "Late", "Defaulted"].includes(d.status));
  const settled = mine.filter((d) => d.status === "Repaid");

  return (
    <Page title="Buyer" subtitle="Pay your suppliers' financed bills when they fall due. Your terms do not change; the payment goes to the investors who paid your supplier early.">
      <CompanySection role="buyer" state={company} />

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
    </Page>
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
        {short_ && !busy && (
          <Button small variant="secondary" loading={busy === "faucet"} disabled={!!busy} onClick={faucet}>
            Get 1,000 test USD
          </Button>
        )}
      </div>
      <ErrorText error={error} />
    </div>
  );
}
