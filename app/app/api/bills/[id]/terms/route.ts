import { fail, live, ok } from "@/lib/server/respond";
import { read } from "@/lib/server/store";

// What CRE underwrites: the fields that do not change once the bill is raised. Every node in
// the DON must receive identical bytes, so run status and other moving parts are left out.
export async function GET(_req: Request, ctx: RouteContext<"/api/bills/[id]/terms">) {
  await live();
  const { id } = await ctx.params;
  const b = read().bills.find((bill) => bill.id === id);
  if (!b) return fail("Bill not found", 404);
  return ok({
    id: b.id,
    ref: b.ref,
    irn: b.irn,
    kind: b.kind,
    seller: b.seller,
    buyer: b.buyer,
    amountPaise: b.amountPaise,
    dueDate: b.dueDate,
    fileHash: b.fileHash,
  });
}
