import { getAddress, isAddress, isHex } from "viem";
import { einvoiceByIrn } from "@/lib/server/mock";
import { fail, live, ok } from "@/lib/server/respond";
import { nextBillId, read, write, type Bill } from "@/lib/server/store";

const DAY = 86_400;

export async function GET(req: Request) {
  await live();
  const params = new URL(req.url).searchParams;
  const seller = params.get("seller");
  const buyer = params.get("buyer");
  const bills = read().bills.filter(
    (b) => (!seller || b.seller.gstin === seller) && (!buyer || b.buyer.gstin === buyer),
  );
  return ok([...bills].reverse());
}

/** A seller raises a bill against one of its e-invoices. */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    irn?: string;
    wallet?: string;
    dueDate?: number;
    fileHash?: string;
  };
  const einvoice = body.irn ? einvoiceByIrn(body.irn) : undefined;
  if (!einvoice) return fail("Unknown e-invoice");
  if (!body.wallet || !isAddress(body.wallet)) return fail("Connect a wallet first");
  if (!body.fileHash || !isHex(body.fileHash) || body.fileHash.length !== 66) return fail("Upload the bill document");
  const now = Math.floor(Date.now() / 1000);
  const dueDate = body.dueDate;
  if (!dueDate || dueDate < now + 120 || dueDate > now + 180 * DAY) {
    return fail("Due date must be between two minutes and 180 days away");
  }

  const wallet = getAddress(body.wallet);
  const fileHash = body.fileHash;
  const d = read();
  const document = d.uploads[fileHash];
  if (!document) return fail("Upload the bill document");
  if (d.wallets[einvoice.sellerGstin] !== wallet) return fail("This wallet does not act for the seller", 403);
  if (d.bills.some((b) => b.irn === einvoice.irn)) return fail("A bill already exists for this e-invoice", 409);

  const bill = write((data) => {
    const created: Bill = {
      id: nextBillId(data),
      irn: einvoice.irn,
      ref: einvoice.docNo,
      kind: einvoice.kind,
      description: einvoice.description,
      seller: { gstin: einvoice.sellerGstin, name: einvoice.sellerName, wallet },
      buyer: { gstin: einvoice.buyerGstin, name: einvoice.buyerName },
      amountPaise: Math.round(einvoice.totInvVal * 100),
      dueDate,
      fileHash,
      fileName: document.name,
      createdAt: now,
      underwriting: null,
    };
    data.bills.push(created);
    return created;
  });
  return ok(bill);
}
