"use client";

import { BuildingIcon, CoinsIcon, DocIcon, GlobeIcon, LinkIcon, PenIcon, ShieldIcon } from "@/components/icons";
import { IconSquare, Page, Row, Section } from "@/components/ui";
import { TAGLINE } from "@/lib/brand";
import { usd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { DealView } from "@/lib/server/hedera";

export default function Home() {
  const { data: deals } = useApi<DealView[]>("/api/deals", 10_000);
  const funded = deals?.filter((d) => ["Active", "Repaid", "Late", "Defaulted"].includes(d.status)) ?? [];
  const paidOut = funded.reduce((sum, d) => sum + BigInt(d.target), 0n);
  const repaid = deals?.filter((d) => d.status === "Repaid").length ?? 0;

  return (
    <Page
      title={TAGLINE}
      subtitle="Indian small businesses had ₹7.34 lakh crore stuck in delayed payments in March 2024. Here a contractor's milestone bill or a supplier's invoice becomes a bond on Hedera, investors fund it, and the business is paid the same day."
    >
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Deals on Hedera" value={deals ? String(deals.length) : "…"} />
        <Stat label="Paid to businesses" value={deals ? usd(paidOut) : "…"} />
        <Stat label="Repaid to investors" value={deals ? String(repaid) : "…"} />
      </div>

      <Section header="How it works">
        <Row
          icon={
            <IconSquare tone="blue">
              <DocIcon />
            </IconSquare>
          }
          title="The business raises a bill"
          subtitle="Against an e-invoice already on the GST registry"
        />
        <Row
          icon={
            <IconSquare tone="indigo">
              <ShieldIcon />
            </IconSquare>
          }
          title="Chainlink CRE underwrites it"
          subtitle="GST registry, buyer credit, FX and Hedera history, checked by the DON"
        />
        <Row
          icon={
            <IconSquare tone="red">
              <LinkIcon />
            </IconSquare>
          }
          title="CCIP carries the decision to Hedera"
          subtitle="From the CRE relay on Avalanche Fuji, in about 30 seconds"
        />
        <Row
          icon={
            <IconSquare tone="purple">
              <GlobeIcon />
            </IconSquare>
          }
          title="An ATS bond is issued for the bill"
          subtitle="Verified investors fund it; the business is paid on full funding"
        />
        <Row
          icon={
            <IconSquare tone="green">
              <CoinsIcon />
            </IconSquare>
          }
          title="The buyer pays, investors redeem"
          subtitle="Late bills pause the bond and freeze the business until cured"
        />
      </Section>

      <Section header="Open the app as">
        <Row
          icon={
            <IconSquare tone="blue">
              <BuildingIcon />
            </IconSquare>
          }
          title="Business"
          subtitle="Raise a bill and get paid early"
          href="/business"
          chevron
        />
        <Row
          icon={
            <IconSquare tone="indigo">
              <PenIcon />
            </IconSquare>
          }
          title="Buyer"
          subtitle="Pay financed bills"
          href="/buyer"
          chevron
        />
        <Row
          icon={
            <IconSquare tone="green">
              <CoinsIcon />
            </IconSquare>
          }
          title="Investor"
          subtitle="Fund verified bills"
          href="/invest"
          chevron
        />
      </Section>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-4 py-3">
      <div className="text-[22px] font-semibold tracking-tight">{value}</div>
      <div className="text-[13px] text-secondary">{label}</div>
    </div>
  );
}
