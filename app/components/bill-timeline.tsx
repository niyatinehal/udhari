"use client";

import { useState } from "react";
import { addresses, links } from "@/lib/chain";
import { date, day, inr, relative, usd } from "@/lib/format";
import type { DealView } from "@/lib/server/hedera";
import type { Bill } from "@/lib/server/store";
import { CheckIcon } from "./icons";
import { RunLog } from "./run-log";
import { TokenCard } from "./token-card";
import { Check, Spinner } from "./ui";

type Step = { id: string; label: string; detail?: React.ReactNode; state: "done" | "active" | "next" | "waiting" | "failed"; extra?: React.ReactNode };

// What each underwriting check means to the business. The server keys checks by the label the
// workflow logs.
const PLAIN: Record<string, string> = {
  "E-invoice is registered and active": "The invoice is live on the GST portal",
  "Seller, buyer and number match the e-invoice": "Your business, your customer and the invoice number match",
  "Amount matches the e-invoice": "The amount matches the invoice",
  "Seller is a verified business": "Your business is verified",
  "Not financed before": "This invoice has not been funded before",
  "Seller has no late deals": "You have no overdue bills",
  "Buyer credit within policy": "Your customer has a good payment record",
};

const plain = (label: string) => PLAIN[label] ?? label.replace(/^Due within (\d+) days$/, "Your customer pays within $1 days");

/** Where a bill is, in the business's words: from uploading it to the customer paying. */
export function BillTimeline({ bill, deal, action }: { bill: Bill; deal?: DealView; action?: React.ReactNode }) {
  const [showChecks, setShowChecks] = useState(false);
  const [technical, setTechnical] = useState(false);
  const u = bill.underwriting;
  const decision = u?.decision;
  const status = deal?.status;
  const listed = status && status !== "Approved";
  const funded = status && ["Active", "Repaid", "Late", "Defaulted"].includes(status);
  const due = (unix: number) => (unix - bill.createdAt < 86_400 ? date(unix) : day(unix));

  // What the business receives: the bill less the discount for paying it early.
  const fee = decision?.approved ? Math.round((bill.amountPaise * decision.discountBps) / 10_000) : 0;
  const receive = bill.amountPaise - fee;

  const steps: Step[] = [
    {
      id: "uploaded",
      label: "Invoice uploaded",
      detail: (
        <>
          <a className="text-tint" href={`/api/uploads/${bill.fileHash}`} target="_blank" rel="noreferrer">
            {bill.fileName}
          </a>{" "}
          · your customer pays {due(bill.dueDate)}
        </>
      ),
      state: "done",
    },
    !u
      ? {
          id: "check",
          label: "Check your bill",
          detail: "We check the invoice with the GST portal and your customer's payment record. It takes about a minute.",
          state: "next",
        }
      : u.status === "running"
        ? { id: "check", label: "Checking your bill", detail: "About a minute", state: "active" }
        : u.status === "approved" && decision
          ? {
              id: "check",
              label: "Approved",
              detail: `All ${decision.checks.length} checks passed · grade ${decision.gradeLetter} customer`,
              state: "done",
              extra: (
                <>
                  <button type="button" onClick={() => setShowChecks(!showChecks)} className="text-[13px] text-tint">
                    {showChecks ? "Hide checks" : "See what we checked"}
                  </button>
                  {showChecks && (
                    <div className="-mx-4">
                      {decision.checks.map((c) => (
                        <Check key={c.id} ok={c.ok} label={plain(c.label)} />
                      ))}
                    </div>
                  )}
                </>
              ),
            }
          : {
              id: "check",
              label: decision ? "Not approved" : "The check did not finish",
              detail: decision
                ? `We could not confirm that ${decision.checks
                    .filter((c) => !c.ok)
                    .map((c) => plain(c.label).replace(/^The /, "the "))
                    .join("; ")}.`
                : "Please try again.",
              state: "failed",
            },
    {
      id: "token",
      label: "Turned into a token",
      state: listed ? "done" : deal || u?.status === "approved" ? "active" : "waiting",
      detail: listed
        ? "Investors can buy your bill as a digital token on Hedera"
        : deal
          ? "Creating the token, about a minute"
          : u?.status === "approved"
            ? "Sending the approval to Hedera, about 30 seconds"
            : undefined,
      extra: listed && deal ? <TokenCard dealId={deal.id} technical={technical} /> : null,
    },
    {
      id: "paid",
      label: "Paid to you",
      state: funded ? "done" : status === "Open" ? "active" : status === "Expired" ? "failed" : "waiting",
      detail: funded
        ? `${inr(receive)} sent to your wallet ${relative(deal.fundedAt)}, as ${usd(deal.target)} in digital dollars`
        : deal && status === "Open"
          ? `Investors have funded ${inr(Math.floor((receive * Number(deal.funded)) / Number(deal.target)))} of ${inr(receive)}`
          : status === "Expired"
            ? "Not fully funded in time. You owe nothing."
            : undefined,
    },
    {
      id: "repaid",
      label: "Customer pays",
      state: status === "Repaid" ? "done" : status === "Late" || status === "Defaulted" ? "failed" : funded ? "next" : "waiting",
      detail:
        deal && status === "Repaid"
          ? `${bill.buyer.name} paid ${relative(deal.repaidAt)}. All done.`
          : status === "Late" || status === "Defaulted"
            ? "Payment is late. New bills are on hold until it arrives."
            : funded
              ? `${bill.buyer.name} pays ${inr(bill.amountPaise)} ${relative(deal.dueDate)}, as usual`
              : undefined,
    },
  ];

  return (
    <div data-bill={bill.ref}>
      <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-3">
        <div className="min-w-0">
          <div className="text-[17px] font-semibold">{bill.buyer.name}</div>
          <div className="text-[13px] text-secondary">
            {bill.ref} · {bill.description}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[17px] font-semibold">{inr(bill.amountPaise)}</div>
          <div className="text-[13px] text-secondary">{bill.kind === "milestone" ? "Milestone bill" : "Invoice"}</div>
        </div>
      </div>

      {decision?.approved && (
        <div data-offer className="mx-4 mt-2 flex items-center justify-between gap-3 rounded-lg bg-fill px-3 py-2.5">
          <div>
            <div className="text-[13px] text-secondary">You get</div>
            <div className="text-[22px] font-semibold leading-tight">{inr(receive)}</div>
          </div>
          <div className="text-right text-[13px] text-secondary">
            <div>
              Fee {inr(fee)} ({(decision.discountBps / 100).toFixed(2)}%)
            </div>
            <div>{status && funded ? "paid out" : "as soon as investors fund it"}</div>
          </div>
        </div>
      )}

      <ol className="px-4 pb-3 pt-3">
        {steps.map((s, i) => (
          <li key={s.id} data-step={s.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepDot state={s.state} />
              {i < steps.length - 1 && <div className={`w-px flex-1 ${s.state === "done" ? "bg-[#34c759]" : "bg-separator"}`} />}
            </div>
            <div className="min-w-0 flex-1 pb-3">
              <div className={`text-[15px] ${s.state === "waiting" ? "text-tertiary" : ""}`}>{s.label}</div>
              {s.detail && <div className="text-[13px] text-secondary">{s.detail}</div>}
              {s.extra}
            </div>
          </li>
        ))}
      </ol>
      {action && <div className="px-4 pb-4">{action}</div>}

      {u && (
        <div className="border-t border-separator">
          <button type="button" onClick={() => setTechnical(!technical)} className="w-full px-4 py-2.5 text-left text-[13px] text-tint">
            {technical ? "Hide technical details" : "Technical details"}
          </button>
          {technical && (
            <div data-technical className="pb-2">
              {decision && (
                <p className="px-4 pb-1 text-[13px] text-secondary">
                  Grade {decision.gradeLetter} at {(decision.annualRateBps / 100).toFixed(0)}% a year: a {(decision.discountBps / 100).toFixed(2)}%
                  discount on a {usd(decision.faceValue)} face value at ₹{decision.inrPerUsd.toFixed(2)}/USD.
                  {deal && (
                    <>
                      {" "}
                      Deal{" "}
                      <a className="text-tint" href={links.hashscanContract(addresses.dealManager)} target="_blank" rel="noreferrer">
                        #{deal.id}
                      </a>{" "}
                      on Hedera, delivered by Chainlink CCIP from Avalanche Fuji.
                    </>
                  )}
                </p>
              )}
              <RunLog runId={u.runId} />
              {decision && (
                <div>
                  {decision.checks.map((c) => (
                    <Check key={c.id} ok={c.ok} label={c.label} detail={c.detail} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepDot({ state }: { state: Step["state"] }) {
  if (state === "done")
    return (
      <span className="grid size-5 place-items-center rounded-full bg-[#34c759] text-white">
        <CheckIcon className="size-3" />
      </span>
    );
  if (state === "active")
    return (
      <span className="grid size-5 place-items-center text-tint">
        <Spinner />
      </span>
    );
  if (state === "next") return <span className="size-5 rounded-full border-2 border-tint" />;
  if (state === "failed") return <span className="size-5 rounded-full border-2 border-[#ff3b30]" />;
  return <span className="size-5 rounded-full border-2 border-separator" />;
}
