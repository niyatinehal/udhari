import { einvoiceByIrn } from "@/lib/server/mock";
import { fail, live, ok } from "@/lib/server/respond";

// Mock GST Invoice Registration Portal: e-invoice details by IRN.
export async function GET(_req: Request, ctx: RouteContext<"/api/mock/irp/[irn]">) {
  await live();
  const { irn } = await ctx.params;
  const einvoice = einvoiceByIrn(irn);
  return einvoice ? ok(einvoice) : fail("IRN not found", 404);
}
