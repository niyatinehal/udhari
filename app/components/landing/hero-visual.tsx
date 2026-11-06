import { Certificate, CheckCircle } from "@phosphor-icons/react/dist/ssr";

// Deal #7 as it ran on testnet: Indigo Lane's first lot to Vastrakala Retail, from the demo video.
const BILL = {
  customer: "Vastrakala Retail Pvt Ltd",
  line: "IL/26-27/0001 · First lot: 200 hand block printed kurtas",
  amount: "₹1,57,500",
  token: "Bill IL/26-27/0001",
  funded: "$1,653.68",
  paysOut: "6 Dec",
};

const STEPS = [
  { label: "Invoice uploaded", detail: "IL-26-27-0001-signed.pdf · customer pays in 30 days" },
  { label: "Approved", detail: "All 8 checks passed · grade A customer" },
  { label: "Turned into a token", detail: "Investors can buy it on Hedera" },
  { label: "Paid to you", detail: "₹1,56,335 sent the moment it was funded" },
  { label: "Customer pays", detail: "Vastrakala paid in full. All done." },
];

/** A still of the product: one bill's journey and the token it became. */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="rounded-2xl border border-separator bg-card p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08),0_32px_64px_rgba(0,0,0,0.08)]">
        <div className="rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-semibold">{BILL.customer}</p>
              <p className="truncate text-sm text-secondary">{BILL.line}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-semibold">{BILL.amount}</p>
              <p className="text-sm text-secondary">Invoice</p>
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
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{BILL.token}</p>
            <p className="text-xs text-secondary">Digital token on Hedera</p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-secondary">Bought by investors</dt>
          <dd className="text-right font-medium">{BILL.funded}</dd>
          <dt className="text-secondary">Pays out on</dt>
          <dd className="text-right font-medium">{BILL.paysOut}</dd>
          <dt className="text-secondary">Backed by</dt>
          <dd className="truncate text-right font-medium">the signed bill</dd>
        </dl>
      </div>
    </div>
  );
}
