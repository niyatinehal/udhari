import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Address, Hex } from "viem";
import { repoRoot } from "./env";

// Off-chain records: bills waiting for underwriting, investor KYC applications,
// wallet bindings for companies and CRE run history. A JSON file is enough for a testnet demo.

export type Decision = {
  billId: string;
  approved: boolean;
  grade: number;
  gradeLetter: string;
  annualRateBps: number;
  discountBps: number;
  inrPerUsd: number;
  faceValue: string;
  dueDate: number;
  docHash: Hex;
  checks: { id: string; label: string; ok: boolean; detail: string }[];
  txHash: Hex | null;
};

export type Bill = {
  id: string;
  irn: string;
  ref: string;
  kind: "invoice" | "milestone";
  description: string;
  seller: { gstin: string; name: string; wallet: Address };
  buyer: { gstin: string; name: string };
  amountPaise: number;
  dueDate: number;
  fileHash: Hex;
  fileName: string;
  createdAt: number;
  underwriting: { runId: string; status: "running" | "approved" | "declined" | "failed"; decision?: Decision } | null;
};

export type Investor = {
  wallet: Address;
  name: string;
  pan: string;
  country: string;
  createdAt: number;
  kyc: { runId: string; status: "running" | "verified" | "rejected" | "failed"; reasons?: string[]; txHash?: Hex } | null;
};

export type Run = {
  id: string;
  workflow: string;
  payload: unknown;
  status: "queued" | "running" | "done" | "failed";
  logs: string[];
  result: unknown;
  txHash: Hex | null;
  messageId: Hex | null;
  startedAt: number;
  endedAt: number | null;
};

export type Upload = { hash: Hex; name: string; type: string; size: number; uploadedAt: number };

export type BusinessDocument = { kind: string; label: string; hash: Hex; name: string; size: number };

export type Business = {
  gstin: string;
  legalName: string;
  tradeName: string;
  constitution: string;
  address: string;
  wallet: Address;
  documents: BusinessDocument[];
  status: "verified";
  verifiedAt: number;
};

type Data = {
  wallets: Record<string, Address>; // GSTIN -> wallet that acts for the company
  businesses: Record<string, Business>; // GSTIN -> registered seller
  uploads: Record<string, Upload>; // content hash -> uploaded file
  bills: Bill[];
  investors: Record<string, Investor>; // lowercase wallet -> application
  runs: Run[];
};

// Kept outside app/ so the dev server does not treat every write as a source change.
const file = path.join(repoRoot, ".data", "store.json");

const empty = (): Data => ({ wallets: {}, businesses: {}, uploads: {}, bills: [], investors: {}, runs: [] });

const load = (): Data => {
  try {
    return { ...empty(), ...(JSON.parse(readFileSync(file, "utf8")) as Partial<Data>) };
  } catch {
    return empty();
  }
};

export const uploadsDir = path.join(repoRoot, ".data", "uploads");

// One cache per process: dev reloads create new module instances, and each must see the same data.
const cache = globalThis as unknown as { storeData?: Data };

export const read = (): Data => (cache.storeData ??= load());

/** Applies a change and writes the file atomically. */
export const write = <T>(change: (d: Data) => T): T => {
  const d = read();
  const result = change(d);
  d.runs = d.runs.slice(-100);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(d, null, 2));
  renameSync(`${file}.tmp`, file);
  return result;
};

export const nextBillId = (d: Data) => `B-${String(d.bills.length + 1).padStart(4, "0")}`;
