"use client";

import { links } from "@/lib/chain";
import { date, short, usd } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { GlobeIcon } from "./icons";
import { IconSquare } from "./ui";

type Token = {
  address: string;
  name: string;
  symbol: string;
  isin: string;
  totalSupply: string;
  maxSupply: string;
  maturity: number;
  docHash: string;
  document: { name: string; hash: string; url: string } | null;
  irn: string | null;
};

/** The bill as a token: the deal's ATS bond read from Hedera, and the documents behind it. */
export function TokenCard({ dealId }: { dealId: number }) {
  const { data: token } = useApi<Token>(`/api/deals/${dealId}/token`, 15_000);
  if (!token) return null;
  const rows: [string, React.ReactNode][] = [
    ["Symbol", token.symbol],
    ["ISIN", token.isin],
    ["Units issued", `${usd(token.totalSupply)} of ${usd(token.maxSupply)}`],
    ["Matures", date(token.maturity)],
    [
      "Backed by",
      token.document ? (
        <a className="text-tint" href={token.document.url} target="_blank" rel="noreferrer">
          {token.document.name}
        </a>
      ) : (
        "the bill"
      ),
    ],
    ["Document hash", <span key="d" className="font-mono">{short(token.document?.hash ?? "")}</span>],
    ["E-invoice on chain", <span key="i" className="font-mono">{short(token.docHash)}</span>],
    [
      "Contract",
      <a key="c" className="font-mono text-tint" href={links.hashscanContract(token.address)} target="_blank" rel="noreferrer">
        {short(token.address)}
      </a>,
    ],
  ];
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-separator">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <IconSquare tone="purple">
          <GlobeIcon />
        </IconSquare>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold">{token.name}</div>
          <div className="text-[13px] text-secondary">Hedera Asset Tokenization Studio bond</div>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-separator px-3 py-2.5 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-secondary">{k}</dt>
            <dd className="truncate text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
