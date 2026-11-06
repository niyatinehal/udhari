import { createHash } from "node:crypto";

// Stand-ins for systems a real deployment would call: the GST e-invoice registry (IRP), a
// commercial credit bureau and a KYC provider. CRE workflows fetch these over HTTP exactly as
// they would fetch the real services. Companies and numbers are fictional.

export type Company = {
  gstin: string;
  name: string;
  city: string;
  sector: string;
  role: "seller" | "buyer";
};

export const companies: Company[] = [
  { gstin: "27AAJCK4821M1Z5", name: "Kavya Infra Projects Pvt Ltd", city: "Thane", sector: "Civil contractor", role: "seller" },
  { gstin: "27AAFFN2290Q1ZK", name: "Nirmal Precision Components", city: "Pune", sector: "Auto components", role: "seller" },
  { gstin: "27AACCA7712R1Z3", name: "Arcadia Realty Ltd", city: "Mumbai", sector: "Real estate", role: "buyer" },
  { gstin: "29AABCV3391D1ZP", name: "Vertex Motors India Ltd", city: "Bengaluru", sector: "Automotive", role: "buyer" },
  { gstin: "27AADCH6604K1ZR", name: "Harbour Logistics Pvt Ltd", city: "Bhiwandi", sector: "Warehousing", role: "buyer" },
  { gstin: "27AAICS5530F1Z8", name: "Sunrise Hospitality Pvt Ltd", city: "Lonavala", sector: "Hotels", role: "buyer" },
];

export const companyByGstin = (gstin: string) => companies.find((c) => c.gstin === gstin);

export type EInvoice = {
  irn: string;
  ackNo: string;
  ackDt: string;
  status: "ACT" | "CNL";
  docType: "INV";
  docNo: string;
  docDt: string;
  sellerGstin: string;
  sellerName: string;
  buyerGstin: string;
  buyerName: string;
  description: string;
  kind: "invoice" | "milestone";
  totInvVal: number;
};

type Seed = Omit<EInvoice, "irn" | "ackNo" | "ackDt" | "sellerName" | "buyerName" | "docType">;

const seeds: Seed[] = [
  { docNo: "KIP/INV/26-27/034", docDt: "05/11/2026", sellerGstin: "27AAJCK4821M1Z5", buyerGstin: "27AACCA7712R1Z3", description: "Podium waterproofing, Tower A", kind: "invoice", totInvVal: 52800, status: "ACT" },
  { docNo: "KIP/INV/26-27/033", docDt: "05/11/2026", sellerGstin: "27AAJCK4821M1Z5", buyerGstin: "27AADCH6604K1ZR", description: "Racking foundations, Bhiwandi unit 4", kind: "invoice", totInvVal: 46500, status: "ACT" },
  { docNo: "NPC/26-27/0419", docDt: "05/11/2026", sellerGstin: "27AAFFN2290Q1ZK", buyerGstin: "29AABCV3391D1ZP", description: "Steering column brackets, 2,400 pcs", kind: "invoice", totInvVal: 61200, status: "ACT" },
  { docNo: "KIP/RA/26-27/014", docDt: "02/11/2026", sellerGstin: "27AAJCK4821M1Z5", buyerGstin: "27AACCA7712R1Z3", description: "RA bill 4: RCC frame, Tower B, Thane West", kind: "milestone", totInvVal: 125000, status: "ACT" },
  { docNo: "KIP/RA/26-27/015", docDt: "04/11/2026", sellerGstin: "27AAJCK4821M1Z5", buyerGstin: "27AACCA7712R1Z3", description: "RA bill 5: blockwork and plaster, Tower B", kind: "milestone", totInvVal: 96400, status: "ACT" },
  { docNo: "KIP/INV/26-27/031", docDt: "29/10/2026", sellerGstin: "27AAJCK4821M1Z5", buyerGstin: "27AADCH6604K1ZR", description: "Warehouse floor resurfacing, Bhiwandi unit 3", kind: "invoice", totInvVal: 58250, status: "ACT" },
  { docNo: "KIP/INV/26-27/029", docDt: "21/10/2026", sellerGstin: "27AAJCK4821M1Z5", buyerGstin: "27AAICS5530F1Z8", description: "Lobby renovation, Lonavala property", kind: "invoice", totInvVal: 74800, status: "ACT" },
  { docNo: "KIP/INV/26-27/027", docDt: "14/10/2026", sellerGstin: "27AAJCK4821M1Z5", buyerGstin: "27AACCA7712R1Z3", description: "Site mobilisation, Tower C", kind: "invoice", totInvVal: 40000, status: "CNL" },
  { docNo: "NPC/26-27/0412", docDt: "30/10/2026", sellerGstin: "27AAFFN2290Q1ZK", buyerGstin: "29AABCV3391D1ZP", description: "Machined brake brackets, 1,800 pcs", kind: "invoice", totInvVal: 148600, status: "ACT" },
  { docNo: "NPC/26-27/0415", docDt: "03/11/2026", sellerGstin: "27AAFFN2290Q1ZK", buyerGstin: "29AABCV3391D1ZP", description: "CNC gearbox housings, 600 pcs", kind: "invoice", totInvVal: 82300, status: "ACT" },
];

// The IRP derives an IRN as SHA-256 over seller GSTIN, financial year, document type and number.
const irnFor = (s: Seed) => createHash("sha256").update(`${s.sellerGstin}2026-27INV${s.docNo}`).digest("hex");

export const einvoices: EInvoice[] = seeds.map((s, i) => ({
  ...s,
  irn: irnFor(s),
  ackNo: `1126${String(10_000_000_000 + i * 7_331_117).slice(-11)}`,
  ackDt: `${s.docDt} 11:${String(10 + i * 7).padStart(2, "0")}:00`,
  docType: "INV",
  sellerName: companyByGstin(s.sellerGstin)!.name,
  buyerName: companyByGstin(s.buyerGstin)!.name,
}));

export const einvoiceByIrn = (irn: string) => einvoices.find((e) => e.irn === irn);

export type CreditReport = {
  gstin: string;
  legalName: string;
  cmrRank: number;
  avgDaysLate: number;
  openDefaults: number;
  bureau: string;
};

const credit: Record<string, Omit<CreditReport, "gstin" | "legalName" | "bureau">> = {
  "27AACCA7712R1Z3": { cmrRank: 2, avgDaysLate: 6, openDefaults: 0 },
  "29AABCV3391D1ZP": { cmrRank: 4, avgDaysLate: 14, openDefaults: 0 },
  "27AADCH6604K1ZR": { cmrRank: 6, avgDaysLate: 22, openDefaults: 0 },
  "27AAICS5530F1Z8": { cmrRank: 9, avgDaysLate: 61, openDefaults: 2 },
};

export const creditReport = (gstin: string): CreditReport | undefined => {
  const c = credit[gstin];
  const company = companyByGstin(gstin);
  return c && company ? { gstin, legalName: company.name, bureau: "Mock commercial bureau", ...c } : undefined;
};

export type KycRecord = {
  pan: string;
  status: "VALID" | "INVALID";
  holderType: "individual" | "company" | "other";
  sanctionsHit: boolean;
  provider: string;
};

// PAN: five letters, four digits, one letter. The fourth letter is the holder type.
const PAN = /^[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]$/;
// One PAN on the mock watchlist, to show a rejection.
const WATCHLIST = new Set(["AAAPZ9999Z"]);

export const kycRecord = (pan: string): KycRecord => {
  const valid = PAN.test(pan);
  const type = pan[3];
  return {
    pan,
    status: valid ? "VALID" : "INVALID",
    holderType: type === "P" ? "individual" : type === "C" ? "company" : "other",
    sanctionsHit: WATCHLIST.has(pan),
    provider: "Mock KYC provider",
  };
};
