import { creditReport } from "@/lib/server/mock";
import { fail, live, ok } from "@/lib/server/respond";

// Mock commercial credit bureau: CMR rank (1 lowest risk to 10) and payment behaviour by GSTIN.
export async function GET(_req: Request, ctx: RouteContext<"/api/mock/bureau/[gstin]">) {
  await live();
  const { gstin } = await ctx.params;
  const report = creditReport(gstin);
  return report ? ok(report) : fail("No credit history for this GSTIN", 404);
}
