import { businessByGstin } from "@/lib/server/business";
import { fail, live, ok } from "@/lib/server/respond";

// What CRE reads to confirm the seller is a verified business.
export async function GET(_req: Request, ctx: RouteContext<"/api/businesses/[gstin]">) {
  await live();
  const { gstin } = await ctx.params;
  const business = businessByGstin(gstin);
  if (!business) return fail("Business not registered", 404);
  return ok({
    gstin: business.gstin,
    legalName: business.legalName,
    wallet: business.wallet,
    status: business.status,
    verifiedAt: business.verifiedAt,
    documents: business.documents.map((d) => ({ kind: d.kind, hash: d.hash })),
  });
}
