import { einvoices } from "@/lib/server/mock";
import { fail, live, ok } from "@/lib/server/respond";
import { read } from "@/lib/server/store";

// A seller's e-invoices as the GST registry lists them, with any bill already raised on each.
export async function GET(req: Request) {
  await live();
  const seller = new URL(req.url).searchParams.get("seller");
  if (!seller) return fail("seller is required");
  const bills = read().bills;
  return ok(
    einvoices
      .filter((e) => e.sellerGstin === seller)
      .map((e) => ({ ...e, billId: bills.find((b) => b.irn === e.irn)?.id ?? null })),
  );
}
