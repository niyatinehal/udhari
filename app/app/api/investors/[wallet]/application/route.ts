import { fail, live, ok } from "@/lib/server/respond";
import { read } from "@/lib/server/store";

// What the CRE KYC workflow reads: the application alone, without its moving status.
export async function GET(_req: Request, ctx: RouteContext<"/api/investors/[wallet]/application">) {
  await live();
  const { wallet } = await ctx.params;
  const investor = read().investors[wallet.toLowerCase()];
  if (!investor) return fail("No application for this wallet", 404);
  const { name, pan, country, createdAt } = investor;
  return ok({ wallet: investor.wallet, name, pan, country, createdAt });
}
