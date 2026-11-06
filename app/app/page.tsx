import {
  ArrowRight,
  ArrowUpRight,
  Buildings,
  Certificate,
  HandCoins,
  LinkSimple,
  PauseCircle,
  Plus,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { HeroVisual } from "@/components/landing/hero-visual";
import { LiveStats } from "@/components/landing/live-stats";
import { Reveal } from "@/components/landing/reveal";
import { Tagline } from "@/components/landing/tagline";
import { addresses, links } from "@/lib/chain";

const EASE = "transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

function PrimaryCta({ children = "Raise your first bill" }: { children?: React.ReactNode }) {
  return (
    <Link
      href="/business"
      className={`inline-flex items-center gap-2 rounded-full bg-label px-3 py-2 text-base font-semibold text-bg hover:-translate-y-px hover:opacity-90 active:scale-[0.98] ${EASE} ${FOCUS}`}
    >
      {children}
      <ArrowRight weight="bold" className="size-4" aria-hidden />
    </Link>
  );
}

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[680px] text-center">
      <p className="text-sm font-semibold text-tint">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-lg text-secondary text-pretty">{children}</p>}
    </div>
  );
}

const BENEFITS = [
  {
    icon: HandCoins,
    tone: "bg-[#34c759]",
    title: "Paid when the bill is funded",
    body: "The investment that completes funding pays your business in the same transaction. No payout run, no waiting for the due date.",
  },
  {
    icon: ShieldCheck,
    tone: "bg-[#5856d6]",
    title: "Nothing taken on trust",
    body: "A Chainlink CRE workflow checks the GST registry, your KYB, the buyer's credit, the exchange rate and Hedera history. Eight checks, run by the DON itself.",
  },
  {
    icon: Certificate,
    tone: "bg-[#af52de]",
    title: "One bond per bill",
    body: "Each bill becomes its own Hedera ATS bond with an ISIN, backed by the document you uploaded. Only verified investors can hold it.",
  },
  {
    icon: PauseCircle,
    tone: "bg-[#ff9500]",
    title: "Late bills are contained",
    body: "If a buyer misses the due date, the CRE monitor pauses that bond and blocks new bills from the business until it is paid.",
  },
];

const STEPS = [
  {
    title: "Register and raise a bill",
    body: "Enter your GSTIN, upload your KYB documents, then pick an e-invoice from the GST registry and upload the certified bill.",
  },
  {
    title: "Chainlink underwrites it",
    body: "CRE grades the buyer and prices the discount for the days left. CCIP carries the approval from Avalanche Fuji to Hedera in about 30 seconds.",
  },
  {
    title: "Investors fund the bond",
    body: "You are paid on full funding. On the due date your client pays the bill and investors redeem its face value.",
  },
];

// Deal #6 from the demo, every step a public testnet transaction.
const PROOF = [
  { step: "CRE underwrites the bill and signs a report", chain: "Avalanche Fuji", url: "https://testnet.snowtrace.io/tx/0x70a17f9c5b4d89516485fdf85da9b74952d7e7329e314af51f03c7e2a579c2bf" },
  { step: "CCIP delivers the approval", chain: "Fuji to Hedera", url: "https://ccip.chain.link/msg/0xea3d125e2f406bf2337415c5518a3b7bc720e3133c93d9fca01f3765ca24aa6b" },
  { step: "The bill becomes ATS bond BILL6", chain: "Hedera", url: "https://hashscan.io/testnet/transaction/0xa932b8c28a177009499e354556299ba41245b35c6e094b0ccf2c45c55986f41f" },
  { step: "An investor funds it and the business is paid", chain: "Hedera", url: "https://hashscan.io/testnet/transaction/0xb64ca93b615225a3b2c063dafda245742ff3a9935de016bf0fa52047bd806353" },
  { step: "The CRE monitor marks it late, the bond pauses", chain: "Fuji to Hedera", url: "https://ccip.chain.link/msg/0x84ce6055e05330b4c3d97d40abbf13edb7ae5621117752baf9a800c0a4bd25ba" },
  { step: "The buyer pays, the bond unpauses", chain: "Hedera", url: "https://hashscan.io/testnet/transaction/0x90530124af72910cdeb2d4e27cbf94b139a9f847e5fd94a36a7a513c393c3982" },
  { step: "The investor redeems the face value", chain: "Hedera", url: "https://hashscan.io/testnet/transaction/0x57ccb80e7ce67169f823d17e4a94e76c17a498176da02a138aff3d651da06d61" },
];

const GRADES = [
  { grade: "A", rate: "9%", tone: "bg-[#34c759]" },
  { grade: "B", rate: "11%", tone: "bg-[#30b0c7]" },
  { grade: "C", rate: "14%", tone: "bg-[#ffcc00]" },
  { grade: "D", rate: "18%", tone: "bg-[#ff9500]" },
];

const FAQ = [
  {
    q: "Is this real money?",
    a: "Not yet. Everything runs on Hedera testnet and Avalanche Fuji, with test USD in place of USDC. Every transaction is real and public, so you can follow each bill on HashScan.",
  },
  {
    q: "What does my client have to do?",
    a: "Nothing new. The GST e-invoice is the record of what they owe, and they pay the bill as they normally would. In production we also read their acceptance of the invoice from the GST Invoice Management System.",
  },
  {
    q: "How is the discount set?",
    a: "From the buyer's credit grade and the days left until the due date. Grade A bills are priced at 9% a year, so a bill due in 30 days costs about 0.74% of its value.",
  },
  {
    q: "Who can invest?",
    a: "Anyone who passes KYC. The check runs as a Chainlink CRE workflow and marks the wallet verified on Hedera, and every bill's bond refuses wallets that are not verified.",
  },
  {
    q: "What happens if the buyer pays late?",
    a: "The CRE monitor marks the bill late. Its bond is paused and the business cannot raise new bills until the buyer pays, which unpauses everything.",
  },
  {
    q: "What if a bill is not fully funded?",
    a: "When its due date passes the deal closes and investors get their money back one for one. The business owes nothing.",
  },
  {
    q: "Can the same invoice be financed twice?",
    a: "No. The hash of its IRN, the e-invoice's national identifier, is recorded on Hedera, and the contract refuses a second approval for it.",
  },
  {
    q: "Why Hedera and Chainlink?",
    a: "Hedera's Asset Tokenization Studio issues each bill as a compliant bond with an ISIN. Chainlink CRE fetches and checks the real world, and CCIP brings its decisions to Hedera.",
  },
];

export default function Home() {
  return (
    <main id="main" className="overflow-x-clip">
      {/* Hero */}
      <section className="px-4 pb-24 pt-32 sm:pt-40">
        <Reveal className="mx-auto flex max-w-[680px] flex-col items-center text-center">
          <h1 className="hero-gradient text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Get paid today for bills <br className="hidden sm:inline" />
            your clients pay in 90 days
          </h1>
          <p className="mt-6 max-w-[680px] text-lg text-secondary text-pretty">
            Bills turns a GST e-invoice into a bond on Hedera. Verified investors fund it, and your business is paid the moment it is fully
            funded. Chainlink checks every bill before anyone puts money in.
          </p>
          <div className="mt-8">
            <PrimaryCta />
          </div>
          <div className="mt-6">
            <LiveStats />
          </div>
        </Reveal>
        <Reveal delay={150} className="mx-auto mt-16 max-w-3xl px-2">
          <HeroVisual />
        </Reveal>
        <Reveal delay={250} className="mx-auto mt-24 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-semibold text-tertiary">
          <span>Hedera Asset Tokenization Studio</span>
          <span>Chainlink CRE</span>
          <span>Chainlink CCIP</span>
          <span>Avalanche Fuji</span>
        </Reveal>
      </section>

      {/* Problem */}
      <section className="px-4 py-24">
        <Reveal>
          <SectionHeading eyebrow="The problem" title="The law says 45 days. Large buyers take months.">
            Under the MSMED Act, buyers must pay small suppliers within 45 days. A contractor finishes a floor, the client certifies the
            bill, and the money arrives after the next project needed it.
          </SectionHeading>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { value: "₹7.34 lakh crore", label: "owed to Indian MSMEs in delayed payments, March 2024" },
            { value: "45 days", label: "the legal limit for paying a small supplier, often ignored" },
            { value: "14%", label: "of MSMEs have access to formal credit to bridge the gap" },
          ].map((s, i) => (
            <Reveal key={s.value} delay={i * 100}>
              <div className="h-full rounded-2xl bg-card p-6">
                <p className="text-3xl font-semibold tracking-tight">{s.value}</p>
                <p className="mt-2 text-sm text-secondary text-pretty">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Tagline */}
      <section className="px-4 py-24 text-center">
        <Tagline lines={["Your client pays in ninety days.", "You get paid today,", "and investors earn the wait."]} />
      </section>

      {/* Benefits */}
      <section className="px-4 py-24">
        <Reveal>
          <SectionHeading eyebrow="For businesses" title="Working capital from bills you already have" />
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={(i % 2) * 100}>
              <div className="h-full rounded-2xl bg-card p-6">
                <span className={`grid size-10 place-items-center rounded-lg text-white ${b.tone}`}>
                  <b.icon weight="bold" className="size-6" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
                <p className="mt-2 text-base text-secondary text-pretty">{b.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-24">
        <Reveal>
          <SectionHeading eyebrow="How it works" title="From e-invoice to cash in three steps" />
        </Reveal>
        <ol className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 100}>
              <li className="h-full rounded-2xl bg-card p-6">
                <span className="grid size-8 place-items-center rounded-full bg-fill text-sm font-semibold">{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-base text-secondary text-pretty">{s.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Proof */}
      <section className="px-4 py-24">
        <Reveal>
          <SectionHeading eyebrow="Proof" title="One bill, end to end, on testnet">
            Vedant Electricals financed its ₹1,18,000 RA bill to Arcadia Realty. Every step below is a public transaction.
          </SectionHeading>
        </Reveal>
        <Reveal className="mx-auto mt-12 max-w-3xl">
          <ol className="overflow-hidden rounded-2xl bg-card">
            {PROOF.map((p, i) => (
              <li key={p.url} className={i > 0 ? "border-t border-separator" : ""}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-4 px-6 py-4 hover:bg-fill ${EASE} ${FOCUS} focus-visible:ring-inset`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-fill text-sm font-semibold">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium">{p.step}</span>
                    <span className="block text-sm text-secondary">{p.chain}</span>
                  </span>
                  <ArrowUpRight className="size-5 shrink-0 text-tertiary" aria-hidden />
                </a>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* Investors */}
      <section className="px-4 py-24">
        <div className="mx-auto grid max-w-4xl items-center gap-12 sm:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold text-tint">For investors</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Bills that mature in weeks, priced by credit</h2>
            <p className="mt-4 text-lg text-secondary text-pretty">
              Fund verified bills from Indian businesses and receive the face value when the buyer pays. Each bill is its own bond, so you
              choose exactly what you hold.
            </p>
            <Link
              href="/invest"
              className={`mt-8 inline-flex items-center gap-2 rounded-full bg-fill px-3 py-2 text-base font-semibold text-tint hover:-translate-y-px active:scale-[0.98] ${EASE} ${FOCUS}`}
            >
              Browse open deals
              <ArrowRight weight="bold" className="size-4" aria-hidden />
            </Link>
          </Reveal>
          <Reveal delay={150}>
            <div className="rounded-2xl bg-card p-2">
              <p className="px-4 pb-2 pt-4 text-sm text-secondary">Annual rate by the buyer&apos;s grade</p>
              {GRADES.map((g) => (
                <div key={g.grade} className="flex items-center gap-4 rounded-lg px-4 py-3">
                  <span className={`grid size-8 place-items-center rounded-lg text-sm font-semibold text-white ${g.tone}`}>{g.grade}</span>
                  <span className="flex-1 text-base">Grade {g.grade}</span>
                  <span className="text-base font-semibold">{g.rate}</span>
                </div>
              ))}
              <p className="px-4 pb-4 pt-2 text-sm text-secondary">Grade E buyers are declined.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-24">
        <Reveal>
          <SectionHeading eyebrow="Questions" title="What people ask first" />
        </Reveal>
        <Reveal className="mx-auto mt-12 max-w-3xl">
          <div className="overflow-hidden rounded-2xl bg-card">
            {FAQ.map((f, i) => (
              <details key={f.q} className={`group ${i > 0 ? "border-t border-separator" : ""}`}>
                <summary
                  className={`flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-base font-medium hover:bg-fill ${FOCUS} focus-visible:ring-inset [&::-webkit-details-marker]:hidden`}
                >
                  {f.q}
                  <Plus className={`size-5 shrink-0 text-tertiary group-open:rotate-45 ${EASE}`} aria-hidden />
                </summary>
                <p className="px-6 pb-6 text-base text-secondary text-pretty">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Final call to action */}
      <section className="px-4 py-24">
        <Reveal className="mx-auto flex max-w-[680px] flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-tint text-white">
            <Buildings weight="bold" className="size-6" aria-hidden />
          </span>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Stop waiting on your client&apos;s payment cycle</h2>
          <p className="mt-4 text-lg text-secondary text-pretty">
            Register with your GSTIN, raise a bill against an e-invoice, and get paid once it is funded. If it is not funded by its due date,
            nothing changes for you.
          </p>
          <div className="mt-8">
            <PrimaryCta />
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-separator px-4 py-12">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 text-sm text-secondary sm:flex-row sm:items-center sm:justify-between">
          <p>Bills · ETHGlobal Mumbai 2026 · Testnet demo, no real money</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a className={`inline-flex items-center gap-1 hover:text-label ${FOCUS}`} href={links.hashscanContract(addresses.dealManager)} target="_blank" rel="noreferrer">
              <LinkSimple className="size-4" aria-hidden /> DealManager on HashScan
            </a>
            <a className={`inline-flex items-center gap-1 hover:text-label ${FOCUS}`} href={`https://testnet.snowtrace.io/address/${addresses.creRelay}`} target="_blank" rel="noreferrer">
              <LinkSimple className="size-4" aria-hidden /> CreRelay on Snowtrace
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
