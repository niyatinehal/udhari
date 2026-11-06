import { companyByGstin } from "@/lib/server/mock";
import { fail, live, ok } from "@/lib/server/respond";

// Mock GST network taxpayer search: registration details by GSTIN.
export async function GET(_req: Request, ctx: RouteContext<"/api/mock/gstn/[gstin]">) {
  await live();
  const { gstin } = await ctx.params;
  const c = companyByGstin(gstin.toUpperCase());
  if (!c) return fail("GSTIN not found on the GST network", 404);
  return ok({
    gstin: c.gstin,
    legalName: c.name,
    tradeName: c.tradeName,
    constitution: c.constitution,
    address: c.address,
    registeredOn: c.registeredOn,
    status: "Active",
  });
}
