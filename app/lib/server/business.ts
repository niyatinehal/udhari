import { isAddressEqual, type Address } from "viem";
import { companyByGstin } from "./mock";
import { read, type Business } from "./store";

/** Documents a seller uploads to register. A KYB provider would check them in production. */
export const REQUIRED_DOCUMENTS = [
  { kind: "gst", label: "GST registration certificate" },
  { kind: "pan", label: "PAN card of the business" },
] as const;

/**
 * The registered business for a GSTIN. Sellers onboarded before registration existed have only a
 * wallet binding; they count as verified without documents.
 */
export const businessByGstin = (gstin: string): Business | null => {
  const d = read();
  if (d.businesses[gstin]) return d.businesses[gstin];
  const company = companyByGstin(gstin);
  const wallet = d.wallets[gstin];
  if (!company || company.role !== "seller" || !wallet) return null;
  return {
    gstin,
    legalName: company.name,
    tradeName: company.tradeName,
    constitution: company.constitution,
    address: company.address,
    wallet,
    documents: [],
    status: "verified",
    verifiedAt: 0,
  };
};

export const businessByWallet = (wallet: Address): Business | null => {
  const d = read();
  const registered = Object.values(d.businesses).find((b) => isAddressEqual(b.wallet, wallet));
  if (registered) return registered;
  const gstin = Object.entries(d.wallets).find(([g, w]) => isAddressEqual(w, wallet) && companyByGstin(g)?.role === "seller")?.[0];
  return gstin ? businessByGstin(gstin) : null;
};
