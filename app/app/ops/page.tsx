"use client";

import { useState } from "react";
import { BoltIcon, GlobeIcon, LinkIcon } from "@/components/icons";
import { RunLog } from "@/components/run-log";
import { Button, Empty, ErrorText, Grade, IconSquare, Page, Row, Section } from "@/components/ui";
import { dealManagerAbi } from "@/lib/abi";
import { addresses, links } from "@/lib/chain";
import { relative, short, shortHash, usd } from "@/lib/format";
import { api, errorMessage, useApi, useHederaWrite, useNow, useRefresh } from "@/lib/hooks";
import type { DealView } from "@/lib/server/hedera";
import type { Run } from "@/lib/server/store";

export default function OpsPage() {
  const { data: deals } = useApi<DealView[]>("/api/deals");
  const { data: runs } = useApi<Run[]>("/api/runs", 3_000);

  return (
    <Page title="Admin" subtitle="The platform's view: every deal on Hedera and every Chainlink CRE run that moved one.">
      <Section header="Deals on Hedera">
        {!deals && <Empty>Loading</Empty>}
        {deals?.length === 0 && <Empty>No deals yet</Empty>}
        {deals
          ?.slice()
          .reverse()
          .map((d) => (
            <DealOps key={d.id} deal={d} />
          ))}
      </Section>

      <Monitor />

      <Section header="CRE runs">
        {runs?.length === 0 && <Empty>No runs yet</Empty>}
        {runs?.map((r) => (
          <RunRow key={r.id} run={r} />
        ))}
      </Section>

      <Section header="Contracts">
        <Row
          icon={
            <IconSquare tone="purple">
              <GlobeIcon />
            </IconSquare>
          }
          title="DealManager"
          subtitle="Hedera testnet · CCIP receiver, ATS bond issuer, KYC list"
          detail={short(addresses.dealManager)}
          href={links.hashscanContract(addresses.dealManager)}
        />
        <Row
          icon={
            <IconSquare tone="red">
              <LinkIcon />
            </IconSquare>
          }
          title="CreRelay"
          subtitle="Avalanche Fuji · CRE receiver, CCIP sender"
          detail={short(addresses.creRelay)}
          href={`https://testnet.snowtrace.io/address/${addresses.creRelay}`}
        />
        <Row
          icon={
            <IconSquare tone="blue">
              <LinkIcon />
            </IconSquare>
          }
          title="Test USD"
          subtitle="Hedera testnet · stands in for USDC"
          detail={short(addresses.testUsd)}
          href={links.hashscanContract(addresses.testUsd)}
        />
      </Section>
    </Page>
  );
}

function DealOps({ deal }: { deal: DealView }) {
  const refresh = useRefresh();
  const write = useHederaWrite();
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pastDue = deal.dueDate < useNow();

  const act = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      setTx(await fn());
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const open = () => act(async () => (await api<{ txHash: string }>(`/api/deals/${deal.id}/open`, { method: "POST" })).txHash);
  const expire = () =>
    act(() => write({ address: addresses.dealManager, abi: dealManagerAbi, functionName: "expire", args: [BigInt(deal.id)], gas: 200_000n }));

  return (
    <div>
      <Row
        icon={<Grade grade={deal.grade} />}
        title={`#${deal.id} ${deal.ref}`}
        subtitle={`${deal.status} · ${usd(deal.funded)} of ${usd(deal.target)} · due ${relative(deal.dueDate)}`}
        detail={deal.bond !== "0x0000000000000000000000000000000000000000" ? short(deal.bond) : undefined}
      />
      {(deal.status === "Approved" || (deal.status === "Open" && pastDue)) && (
        <div className="px-4 pb-3 pl-[58px]">
          {deal.status === "Approved" ? (
            <Button small loading={busy} onClick={open}>
              Issue ATS bond and list
            </Button>
          ) : (
            <Button small variant="secondary" loading={busy} onClick={expire}>
              Close unfunded deal
            </Button>
          )}
          <ErrorText error={error} />
        </div>
      )}
      {tx && (
        <div className="px-4 pb-3 pl-[58px] text-[13px]">
          <a className="text-tint" href={links.hashscanTx(tx)} target="_blank" rel="noreferrer">
            {shortHash(tx)} on HashScan
          </a>
        </div>
      )}
    </div>
  );
}

function Monitor() {
  const refresh = useRefresh();
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setRunId((await api<Run>("/api/monitor", { method: "POST" })).id);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section header="Monitor" footer="Runs on a CRE cron schedule when deployed. It reads Hedera through the mirror node, marks overdue deals late, and pauses funding if reserves fall short.">
      <Row
        icon={
          <IconSquare tone="orange">
            <BoltIcon />
          </IconSquare>
        }
        title="Check deals and reserves"
        detail={
          <Button small variant="secondary" loading={busy} onClick={run}>
            Run now
          </Button>
        }
      />
      {runId && <RunLog runId={runId} />}
      <ErrorText error={error} />
    </Section>
  );
}

function RunRow({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  const label = run.payload && typeof run.payload === "object" ? Object.values(run.payload as Record<string, string>).join(" ") : "";
  return (
    <div>
      <Row
        title={`${run.workflow}${label ? ` · ${label.length > 20 ? short(label) : label}` : ""}`}
        subtitle={`${run.status} · ${relative(run.startedAt / 1000)}`}
        detail={run.messageId ? "CCIP" : undefined}
        onClick={() => setOpen(!open)}
        chevron
      />
      {open && <RunLog runId={run.id} />}
    </div>
  );
}
