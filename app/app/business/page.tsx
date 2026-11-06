"use client";

import { useState } from "react";
import { useConnection } from "wagmi";
import { BillTimeline } from "@/components/bill-timeline";
import { BuildingIcon, CheckIcon, DocIcon, ShieldIcon } from "@/components/icons";
import { UploadRow, type Uploaded } from "@/components/upload";
import { Button, Choices, Empty, ErrorText, Field, IconSquare, inputClass, Page, Row, Section, Sheet } from "@/components/ui";
import { inr, short } from "@/lib/format";
import { api, errorMessage, useApi, useRefresh } from "@/lib/hooks";
import type { DealView } from "@/lib/server/hedera";
import type { EInvoice } from "@/lib/server/mock";
import type { Bill, Business } from "@/lib/server/store";

type Listed = EInvoice & { billId: string | null };
type Taxpayer = { gstin: string; legalName: string; tradeName: string; constitution: string; address: string; registeredOn: string; status: string };

const DUE_OPTIONS = [
  { value: 7 * 86_400, label: "In 7 days" },
  { value: 30 * 86_400, label: "In 30 days" },
  { value: 45 * 86_400, label: "In 45 days" },
  { value: 60 * 86_400, label: "In 60 days" },
  { value: 90 * 86_400, label: "In 90 days" },
  { value: 15 * 60, label: "In 15 minutes", detail: "For a live demo of the whole cycle" },
];

const DOCUMENTS = [
  { kind: "gst", label: "GST registration certificate", hint: "Form REG-06, PDF or photo" },
  { kind: "pan", label: "PAN card of the business", hint: "PDF or photo" },
];

export default function BusinessPage() {
  const { address } = useConnection();
  const { data: business, isLoading } = useApi<Business | null>(address ? `/api/businesses?wallet=${address}` : null, 10_000);

  return (
    <Page title="Get paid early" subtitle="Turn an invoice your customer will pay later into money today. We check the bill, investors fund it, and you are paid the moment it is funded.">
      {!address ? (
        <Section>
          <Empty>Connect your wallet to get started</Empty>
        </Section>
      ) : isLoading ? null : business ? (
        <Registered business={business} wallet={address} />
      ) : (
        <Register wallet={address} />
      )}
    </Page>
  );
}

function Register({ wallet }: { wallet: `0x${string}` }) {
  const refresh = useRefresh();
  const [gstin, setGstin] = useState("");
  const [taxpayer, setTaxpayer] = useState<Taxpayer | null>(null);
  const [docs, setDocs] = useState<Record<string, Uploaded>>({});
  const [busy, setBusy] = useState<"lookup" | "register" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    setBusy("lookup");
    setError(null);
    setTaxpayer(null);
    try {
      setTaxpayer(await api<Taxpayer>(`/api/mock/gstn/${gstin.trim().toUpperCase()}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const register = async () => {
    setBusy("register");
    setError(null);
    try {
      await api("/api/businesses", {
        method: "POST",
        body: { gstin: taxpayer!.gstin, wallet, documents: Object.entries(docs).map(([kind, d]) => ({ kind, hash: d.hash })) },
      });
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const complete = taxpayer && DOCUMENTS.every((d) => docs[d.kind]);

  return (
    <>
      <Section header="Register your business" footer="We fetch your details and your invoices from the GST portal.">
        <Field label="GSTIN">
          <input
            className={`${inputClass} font-mono uppercase`}
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="27ABCDE1234F1Z5"
            maxLength={15}
          />
          <Button small variant="secondary" loading={busy === "lookup"} disabled={gstin.trim().length !== 15} onClick={lookup}>
            Look up
          </Button>
        </Field>
      </Section>

      {taxpayer && (
        <>
          <Section header="Your business on the GST portal">
            <Row
              icon={
                <IconSquare tone="blue">
                  <BuildingIcon />
                </IconSquare>
              }
              title={taxpayer.legalName}
              subtitle={`${taxpayer.constitution} · registered ${taxpayer.registeredOn}`}
              detail={
                <span className="inline-flex items-center gap-1 text-[#34c759]">
                  <CheckIcon className="size-4" /> {taxpayer.status}
                </span>
              }
            />
            <Row title="Trade name" detail={taxpayer.tradeName} />
            <Row title="Address" subtitle={taxpayer.address} />
          </Section>

          <Section header="Verify your business" footer="Kept private. We use them only to verify your business.">
            {DOCUMENTS.map((d) => (
              <UploadRow key={d.kind} label={d.label} hint={d.hint} value={docs[d.kind] ?? null} onChange={(u) => setDocs((prev) => ({ ...prev, [d.kind]: u }))} />
            ))}
          </Section>

          <Button loading={busy === "register"} disabled={!complete} onClick={register}>
            Register {taxpayer.tradeName}
          </Button>
        </>
      )}
      <ErrorText error={error} />
    </>
  );
}

function Registered({ business, wallet }: { business: Business; wallet: `0x${string}` }) {
  const gstin = business.gstin;
  const { data: invoices } = useApi<Listed[]>(`/api/einvoices?seller=${gstin}`);
  const { data: bills } = useApi<Bill[]>(`/api/bills?seller=${gstin}`, 3_000);
  const { data: deals } = useApi<DealView[]>("/api/deals");
  const [raising, setRaising] = useState<Listed | null>(null);

  return (
    <>
      <Section header="Your business">
        <Row
          icon={
            <IconSquare tone="green">
              <ShieldIcon />
            </IconSquare>
          }
          title={business.legalName}
          subtitle={`GSTIN ${gstin} · verified${business.documents.length ? `, ${business.documents.length} documents` : ""}`}
          detail={short(business.wallet)}
        />
      </Section>

      <Section header="Your invoices" footer="From the GST portal. Pick one your customer has not paid yet.">
        {!invoices && <Empty>Loading</Empty>}
        {invoices?.length === 0 && <Empty>No invoices on the GST portal yet</Empty>}
        {invoices
          ?.filter((e) => e.status === "ACT")
          .map((e) => (
            <div key={e.irn} data-invoice={e.docNo}>
              <Row
                icon={
                  <IconSquare tone="blue">
                    <DocIcon />
                  </IconSquare>
                }
                title={e.buyerName}
                subtitle={`${e.docNo} · ${e.description}`}
                detail={
                  <div className="flex items-center gap-3">
                    <span>{inr(e.totInvVal * 100)}</span>
                    {e.billId ? (
                      <span className="text-[13px]">In progress</span>
                    ) : (
                      <Button small variant="secondary" onClick={() => setRaising(e)}>
                        Get paid now
                      </Button>
                    )}
                  </div>
                }
              />
            </div>
          ))}
      </Section>

      {bills && bills.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="px-4 text-[13px] uppercase tracking-wide text-secondary">Your bills</h2>
          {bills.map((b) => (
            <div key={b.id} className="overflow-hidden rounded-xl bg-card">
              <BillTimeline bill={b} deal={deals?.find((d) => d.billId === b.id)} action={<UnderwriteButton bill={b} />} />
            </div>
          ))}
        </div>
      )}

      <RaiseSheet invoice={raising} wallet={wallet} onClose={() => setRaising(null)} />
    </>
  );
}

function UnderwriteButton({ bill }: { bill: Bill }) {
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = bill.underwriting?.status;
  if (status === "running" || status === "approved") return null;

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
        {status ? "Check again" : "Check my bill"}
      </Button>
      <ErrorText error={error} />
    </>
  );
}

function RaiseSheet({ invoice, wallet, onClose }: { invoice: Listed | null; wallet: `0x${string}`; onClose: () => void }) {
  const refresh = useRefresh();
  const [due, setDue] = useState<number>(30 * 86_400);
  const [file, setFile] = useState<Uploaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!invoice || !file) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/bills", {
        method: "POST",
        body: { irn: invoice.irn, wallet, dueDate: Math.floor(Date.now() / 1000) + due, fileHash: file.hash },
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
    <Sheet open={!!invoice} onClose={onClose} title="Get paid now">
      {invoice && (
        <>
          <Section header="Invoice">
            <Row title={invoice.docNo} subtitle={invoice.description} detail={inr(invoice.totInvVal * 100)} />
            <Row title="Customer" detail={invoice.buyerName} />
          </Section>
          <Section header="When does your customer pay?">
            <Choices options={DUE_OPTIONS} value={due} onChange={setDue} />
          </Section>
          <Section header="Signed copy" footer="The copy your customer signed or stamped on delivery. Investors can see it.">
            <UploadRow
              label={invoice.kind === "milestone" ? "Certified RA bill" : "Signed invoice"}
              hint="PDF or photo"
              value={file}
              onChange={setFile}
            />
          </Section>
          <Button loading={busy} disabled={!file} onClick={submit}>
            Submit bill
          </Button>
          <ErrorText error={error} />
        </>
      )}
    </Sheet>
  );
}
