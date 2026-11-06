import { kycRecord } from "@/lib/server/mock";
import { live, ok } from "@/lib/server/respond";

// Mock KYC provider: PAN validity, holder type and a watchlist check.
export async function GET(_req: Request, ctx: RouteContext<"/api/mock/kyc/[pan]">) {
  await live();
  const { pan } = await ctx.params;
  return ok(kycRecord(pan.toUpperCase()));
}
