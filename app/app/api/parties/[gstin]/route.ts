import { getAddress, isAddress } from "viem";
import { companyByGstin } from "@/lib/server/mock";
import { fail, live, ok } from "@/lib/server/respond";
import { read, write } from "@/lib/server/store";

// The wallet that acts for a company. CRE checks the buyer's confirmation against it.
export async function GET(_req: Request, ctx: RouteContext<"/api/parties/[gstin]">) {
  await live();
  const { gstin } = await ctx.params;
  const company = companyByGstin(gstin);
  if (!company) return fail("Unknown GSTIN", 404);
  return ok({ gstin, name: company.name, wallet: read().wallets[gstin] ?? null });
}

/** Onboarding stand-in: binds the connected wallet to the company. */
export async function POST(req: Request, ctx: RouteContext<"/api/parties/[gstin]">) {
  const { gstin } = await ctx.params;
  const company = companyByGstin(gstin);
  if (!company) return fail("Unknown GSTIN", 404);
  const { wallet } = (await req.json()) as { wallet?: string };
  if (!wallet || !isAddress(wallet)) return fail("A wallet address is required");
  const address = getAddress(wallet);
  write((d) => {
    d.wallets[gstin] = address;
  });
  return ok({ gstin, name: company.name, wallet: address });
}
