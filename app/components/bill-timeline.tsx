"use client";

import { useState } from "react";
import { links } from "@/lib/chain";
import { date, inr, relative, short, usd } from "@/lib/format";
import type { DealView } from "@/lib/server/hedera";
import type { Bill } from "@/lib/server/store";
import { CheckIcon } from "./icons";
import { RunLog } from "./run-log";
import { Check, Spinner } from "./ui";

type Step = { label: string; detail?: React.ReactNode; state: "done" | "active" | "waiting" | "failed"; extra?: React.ReactNode };

/** Where a bill is, from the seller raising it to the buyer repaying investors. */
export function BillTimeline({ bill, deal, action }: { bill: Bill; deal?: DealView; action?: React.ReactNode }) {
  const [showChecks, setShowChecks] = useState(false);
  const u = bill.underwriting;
  const decision = u?.decision;
  const status = deal?.status;
  const listed = status && status !== "Approved";
  const funded = status && ["Active", "Repaid", "Late", "Defaulted"].includes(status);

  const steps: Step[] = [
    { label: "Raised", detail: `${bill.fileName} · due ${date(bill.dueDate)}`, state: "done" },
    {
      label: "Underwritten by Chainlink CRE",
      state: !u ? "active" : u.status === "running" ? "active" : u.status === "approved" ? "done" : "failed",
      detail: !u
        ? "E-invoice, buyer credit, FX and Hedera history, checked by the DON"
        : u.status === "running"
          ? "Running"
          : decision
            ? decision.approved
              ? `Grade ${decision.gradeLetter} · ${(decision.discountBps / 100).toFixed(2)}% discount · ${usd(decision.faceValue)} at ₹${decision.inrPerUsd.toFixed(2)}/USD`
              : `Declined: ${decision.checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase()).join("; ")}`
            : "Run failed",
      extra: u ? (
        <div className="mt-1">
          {(u.status === "running" || showChecks) && <RunLog runId={u.runId} />}
          {u.status !== "running" && (
            <button type="button" onClick={() => setShowChecks(!showChecks)} className="text-[13px] text-tint">
              {showChecks ? "Hide CRE log" : "Show CRE log"}
            </button>
          )}
          {showChecks && decision && (
            <div className="-mx-4 mt-1">
              {decision.checks.map((c) => (
                <Check key={c.id} ok={c.ok} label={c.label} detail={c.detail} />
              ))}
            </div>
          )}
        </div>
      ) : null,
    },
    {
      label: "Approved on Hedera",
      state: deal ? "done" : u?.status === "approved" ? "active" : "waiting",
      detail: deal ? `Deal #${deal.id}, delivered by CCIP from Fuji` : u?.status === "approved" ? "Crossing from Fuji over CCIP, about 30 seconds" : undefined,
    },
    {
      label: "Listed for investors",
      state: listed ? "done" : deal ? "active" : "waiting",
      detail: listed ? (
        <a className="text-tint" href={links.hashscanContract(deal.bond)} target="_blank" rel="noreferrer">
          ATS bond {short(deal.bond)}
        </a>
      ) : deal ? (
        "Waiting for the platform to issue the bond"
      ) : undefined,
    },
    {
      label: "Funded",
      state: funded ? "done" : status === "Open" ? "active" : status === "Expired" ? "failed" : "waiting",
      detail: funded
        ? `${usd(deal.target)} paid to ${short(deal.business)} ${relative(deal.fundedAt)}`
        : deal && status === "Open"
          ? `${usd(deal.funded)} of ${usd(deal.target)} raised`
          : status === "Expired"
            ? "Not fully funded by the due date; investors refunded"
            : undefined,
    },
    {
      label: "Repaid by buyer",
      state: status === "Repaid" ? "done" : status === "Late" || status === "Defaulted" ? "failed" : funded ? "active" : "waiting",
      detail:
        deal && status === "Repaid"
          ? `${usd(deal.repaidAmount)} ${relative(deal.repaidAt)}`
          : status === "Late" || status === "Defaulted"
            ? `${status}: bond paused, seller frozen until repaid`
            : funded
              ? `${usd(deal.faceValue)} due ${relative(deal.dueDate)}`
              : undefined,
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-3">
        <div className="min-w-0">
          <div className="text-[17px] font-semibold">{bill.ref}</div>
          <div className="text-[13px] text-secondary">
            {bill.description} · {bill.seller.name} to {bill.buyer.name}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[17px] font-semibold">{inr(bill.amountPaise)}</div>
          <div className="text-[13px] text-secondary">{bill.kind === "milestone" ? "Milestone bill" : "Invoice"}</div>
        </div>
      </div>
      <ol className="px-4 pb-3 pt-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex gap-3">
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
  if (state === "failed") return <span className="size-5 rounded-full border-2 border-[#ff3b30]" />;
  return <span className="size-5 rounded-full border-2 border-separator" />;
}
