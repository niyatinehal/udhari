import { openDeal } from "@/lib/server/hedera";
import { fail, ok } from "@/lib/server/respond";

/** Operator lists an approved deal: DealManager deploys its ATS bond. */
export async function POST(_req: Request, ctx: RouteContext<"/api/deals/[id]/open">) {
  const { id } = await ctx.params;
  try {
    return ok({ txHash: await openDeal(Number(id)) });
  } catch (err) {
    return fail((err as Error).message.split("\n")[0], 500);
  }
}
