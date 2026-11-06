import { getAddress, isAddress, isAddressEqual } from "viem";
import { businessByWallet, REQUIRED_DOCUMENTS } from "@/lib/server/business";
import { companyByGstin } from "@/lib/server/mock";
import { fail, live, ok } from "@/lib/server/respond";
import { read, write, type Business } from "@/lib/server/store";

/** The business the connected wallet acts for, if any. */
export async function GET(req: Request) {
  await live();
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet || !isAddress(wallet)) return fail("wallet is required");
  return ok(businessByWallet(getAddress(wallet)));
}

/**
 * Registers a seller: its GSTIN must be active on the GST network and its documents uploaded.
 * Stands in for KYB, which a verification provider would run in production.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { gstin?: string; wallet?: string; documents?: { kind: string; hash: string }[] };
  const gstin = body.gstin?.trim().toUpperCase();
  if (!gstin || !body.wallet || !isAddress(body.wallet)) return fail("GSTIN and wallet are required");
  const company = companyByGstin(gstin);
  if (!company) return fail("GSTIN not found on the GST network", 404);
  if (company.role !== "seller") return fail("Only suppliers raise bills here");

  const wallet = getAddress(body.wallet);
  const d = read();
  const documents = [];
  for (const required of REQUIRED_DOCUMENTS) {
    const hash = body.documents?.find((doc) => doc.kind === required.kind)?.hash;
    const upload = hash ? d.uploads[hash] : undefined;
    if (!upload) return fail(`Upload the ${required.label.toLowerCase()}`);
    documents.push({ kind: required.kind, label: required.label, hash: upload.hash, name: upload.name, size: upload.size });
  }
  const existing = d.businesses[gstin];
  if (existing && !isAddressEqual(existing.wallet, wallet)) return fail("This GSTIN is registered to another wallet", 409);

  const business: Business = {
    gstin,
    legalName: company.name,
    tradeName: company.tradeName,
    constitution: company.constitution,
    address: company.address,
    wallet,
    documents,
    status: "verified",
    verifiedAt: Math.floor(Date.now() / 1000),
  };
  write((data) => {
    data.businesses[gstin] = business;
    data.wallets[gstin] = wallet;
  });
  return ok(business);
}
