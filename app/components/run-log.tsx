"use client";

import { useState } from "react";
import { links } from "@/lib/chain";
import { shortHash } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Run } from "@/lib/server/store";
import { CheckIcon, CrossIcon, LinkIcon } from "./icons";
import { Spinner } from "./ui";

const USER = /\[USER LOG\]\s*(.*)$/;

/** Live output of a CRE workflow run, with links to the Fuji transaction and the CCIP message. */
export function RunLog({ runId }: { runId: string }) {
  const { data: run } = useApi<Run>(`/api/runs/${runId}`, 1_500);
  const [all, setAll] = useState(false);
  if (!run) return null;
  const active = run.status === "queued" || run.status === "running";
  const lines = run.logs
    .map((l) => l.match(USER)?.[1])
    .filter((l): l is string => !!l && !l.startsWith("RESULT"));

  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-secondary">
        {active && <Spinner />}
        <span>
          CRE {run.workflow} workflow ·{" "}
          {run.status === "queued" ? "queued" : active ? "running in the simulator" : run.status === "done" ? "finished" : "failed"}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5 font-mono text-[12px] leading-relaxed">
        {lines.map((line, i) => {
          const pass = line.startsWith("PASS ");
          const fail = line.startsWith("FAIL ");
          return (
            <li key={i} className="flex gap-1.5">
              {pass ? <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-[#34c759]" /> : fail ? <CrossIcon className="mt-0.5 size-3.5 shrink-0 text-[#ff3b30]" /> : <span className="w-3.5 shrink-0 text-tertiary">›</span>}
              <span className="break-all">{pass || fail ? line.slice(5) : line}</span>
            </li>
          );
        })}
      </ul>
      {(run.txHash || run.messageId) && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {run.txHash && (
            <a className="inline-flex items-center gap-1 text-tint" href={links.snowtraceTx(run.txHash)} target="_blank" rel="noreferrer">
              <LinkIcon className="size-3.5" /> Report on Fuji {shortHash(run.txHash)}
            </a>
          )}
          {run.messageId && (
            <a className="inline-flex items-center gap-1 text-tint" href={links.ccipMessage(run.messageId)} target="_blank" rel="noreferrer">
              <LinkIcon className="size-3.5" /> CCIP message {shortHash(run.messageId)}
            </a>
          )}
        </div>
      )}
      {run.status === "failed" && (
        <button type="button" onClick={() => setAll(!all)} className="self-start text-[13px] text-tint">
          {all ? "Hide output" : "Show full output"}
        </button>
      )}
      {all && <pre className="max-h-64 overflow-auto rounded-lg bg-fill p-2 text-[11px]">{run.logs.join("\n")}</pre>}
    </div>
  );
}
