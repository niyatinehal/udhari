"use client";

import { useState } from "react";
import { isAddressEqual, keccak256 } from "viem";
import { useConnection } from "wagmi";
import { BillTimeline } from "@/components/bill-timeline";
import { CompanySection, useCompany } from "@/components/company";
import { DocIcon } from "@/components/icons";
import { Button, Choices, Empty, ErrorText, IconSquare, Page, Row, Section, Sheet } from "@/components/ui";
import { inr } from "@/lib/format";
import { api, errorMessage, useApi, useRefresh } from "@/lib/hooks";
import type { DealView } from "@/lib/server/hedera";
import type { EInvoice } from "@/lib/server/mock";
import type { Bill } from "@/lib/server/store";

type Listed = EInvoice & { billId: string | null };

const DUE_OPTIONS = [
  { value: 15 * 60, label: "In 15 minutes", detail: "Demo: shows repayment and late handling live" },
  { value: 7 * 86_400, label: "In 7 days" },
  { value: 30 * 86_400, label: "In 30 days" },
  { value: 60 * 86_400, label: "In 60 days" },
  { value: 90 * 86_400, label: "In 90 days" },
];

export default function BusinessPage() {
  const company = useCompany("seller");
  const gstin = company.company?.gstin;
  const { address } = useConnection();
  const bound = !!(company.company?.wallet && address && isAddressEqual(company.company.wallet, address));
  const { data: invoices } = useApi<Listed[]>(gstin ? `/api/einvoices?seller=${gstin}` : null);
  const { data: bills } = useApi<Bill[]>(gstin ? `/api/bills?seller=${gstin}` : null, 3_000);
  const { data: deals } = useApi<DealView[]>("/api/deals");
  const [raising, setRaising] = useState<Listed | null>(null);

  return (
    <Page title="Business" subtitle="Raise a bill against a GST e-invoice. Once the buyer confirms it and Chainlink CRE underwrites it, investors fund it on Hedera and you are paid at once.">
      <CompanySection role="seller" state={company} />

      {gstin && (
        <Section header="E-invoices on the GST registry" footer="Pulled from the Invoice Registration Portal by GSTIN. Cancelled e-invoices cannot be financed.">
          {!invoices && <Empty>Loading</Empty>}
          {invoices?.map((e) => (
            <Row
              key={e.irn}
              icon={
                <IconSquare tone={e.status === "ACT" ? "blue" : "gray"}>
                  <DocIcon />
                </IconSquare>
              }
              title={e.docNo}
              subtitle={`${e.buyerName} · ${e.description}${e.status === "CNL" ? " · cancelled" : ""}`}
              detail={
                <div className="flex items-center gap-3">
                  <span>{inr(e.totInvVal * 100)}</span>
                  {e.billId ? (
                    <span className="text-[13px]">{e.billId}</span>
                  ) : (
                    <Button small variant="secondary" disabled={!bound} onClick={() => setRaising(e)}>
                      Raise bill
                    </Button>
                  )}
                </div>
              }
            />
          ))}
        </Section>
      )}

      {gstin && bills && bills.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="px-4 text-[13px] uppercase tracking-wide text-secondary">Bills</h2>
          {bills.map((b) => (
            <div key={b.id} className="overflow-hidden rounded-xl bg-card">
              <BillTimeline bill={b} deal={deals?.find((d) => d.billId === b.id)} action={<UnderwriteButton bill={b} />} />
            </div>
          ))}
        </div>
      )}

      <RaiseSheet invoice={raising} wallet={address} onClose={() => setRaising(null)} />
    </Page>
  );
}

function UnderwriteButton({ bill }: { bill: Bill }) {
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = bill.underwriting?.status;
  if (!bill.confirmation || status === "running" || status === "approved") return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/bills/${bill.id}/underwrite`, { method: "POST" });
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button loading={busy} onClick={run}>
        {status ? "Underwrite again" : "Underwrite with Chainlink CRE"}
      </Button>
      <ErrorText error={error} />
    </>
  );
}

function RaiseSheet({ invoice, wallet, onClose }: { invoice: Listed | null; wallet?: `0x${string}`; onClose: () => void }) {
  const refresh = useRefresh();
  const [due, setDue] = useState<number>(60 * 86_400);
  const [file, setFile] = useState<{ name: string; hash: `0x${string}` } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setFile({ name: f.name, hash: keccak256(new Uint8Array(await f.arrayBuffer())) });
  };

  const submit = async () => {
    if (!invoice || !file || !wallet) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/bills", {
        method: "POST",
        body: { irn: invoice.irn, wallet, dueDate: Math.floor(Date.now() / 1000) + due, fileHash: file.hash, fileName: file.name },
      });
      refresh();
      setFile(null);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!invoice} onClose={onClose} title="Raise a bill">
      {invoice && (
        <>
          <Section header="E-invoice">
            <Row title={invoice.docNo} subtitle={invoice.description} detail={inr(invoice.totInvVal * 100)} />
            <Row title="Buyer" detail={invoice.buyerName} />
            <Row title="IRN" detail={<span className="font-mono text-[13px]">{invoice.irn.slice(0, 16)}…</span>} />
          </Section>
          <Section header="Buyer pays">
            <Choices options={DUE_OPTIONS} value={due} onChange={setDue} />
          </Section>
          <Section header="Document" footer="Only its hash leaves your device. The buyer signs this hash along with the terms.">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-4 py-2.5">
              <span className="flex-1 text-[17px] text-tint">{file ? file.name : "Choose the bill or certificate (PDF)"}</span>
              {file && <span className="font-mono text-[13px] text-secondary">{file.hash.slice(0, 10)}…</span>}
              <input type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          </Section>
          <Button loading={busy} disabled={!file} onClick={submit}>
            Send to {invoice.buyerName.split(" ")[0]} for confirmation
          </Button>
          <ErrorText error={error} />
        </>
      )}
    </Sheet>
  );
}
