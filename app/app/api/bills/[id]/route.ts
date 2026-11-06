import { fail, live, ok } from "@/lib/server/respond";
import { read } from "@/lib/server/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/bills/[id]">) {
  await live();
  const { id } = await ctx.params;
  const bill = read().bills.find((b) => b.id === id);
  return bill ? ok(bill) : fail("Bill not found", 404);
}
