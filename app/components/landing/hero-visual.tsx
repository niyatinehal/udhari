import { Certificate, CheckCircle } from "@phosphor-icons/react/dist/ssr";

// Deal #6 as it ran on testnet: Vedant Electricals' RA bill 7 to Arcadia Realty.
const STEPS = [
  { label: "Bill raised", detail: "VEC-RA-7-certified.pdf · due 6 Nov" },
  { label: "Underwritten by Chainlink CRE", detail: "8 checks passed · grade A · 0.25% discount" },
  { label: "Approved on Hedera", detail: "Delivered over CCIP from Avalanche Fuji" },
  { label: "Tokenized as an ATS bond", detail: "BILL6 · one bond for this bill" },
  { label: "Funded", detail: "$1,245.06 paid to Vedant Electricals" },
  { label: "Repaid by Arcadia Realty", detail: "$1,248.18 redeemed by investors" },
];

/** A still of the product: one bill's journey and the token it became. */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="rounded-2xl border border-separator bg-card p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08),0_32px_64px_rgba(0,0,0,0.08)]">
        <div className="rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-semibold">VEC/RA/26-27/007</p>
              <p className="truncate text-sm text-secondary">RA bill 7: electrical works, Tower B, Thane West</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-semibold">₹1,18,000</p>
              <p className="text-sm text-secondary">Milestone bill</p>
            </div>
          </div>
          <ol className="mt-4 flex flex-col gap-3">
            {STEPS.map((s) => (
              <li key={s.label} className="flex items-start gap-3">
                <CheckCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-[#34c759]" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="truncate text-xs text-secondary">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="absolute -bottom-8 -right-2 hidden w-64 rounded-2xl border border-separator bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_32px_rgba(0,0,0,0.14)] sm:block lg:-right-16">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-lg bg-[#af52de] text-white">
            <Certificate weight="bold" className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Bill VEC/RA/26-27/007</p>
            <p className="text-xs text-secondary">Hedera ATS bond</p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-secondary">Symbol</dt>
          <dd className="text-right font-medium">BILL6</dd>
          <dt className="text-secondary">ISIN</dt>
          <dd className="text-right font-mono">ZZ0000000065</dd>
          <dt className="text-secondary">Units</dt>
          <dd className="text-right font-medium">$1,245.06</dd>
        </dl>
      </div>
    </div>
  );
}
