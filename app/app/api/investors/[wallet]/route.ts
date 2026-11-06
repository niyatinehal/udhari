import { getAddress, isAddress } from "viem";
import { startRun } from "@/lib/server/cre";
import { fail, live, ok } from "@/lib/server/respond";
import { read, write } from "@/lib/server/store";

type KycResult = { approved: boolean; reasons: string[]; txHash: `0x${string}` | null };

export async function GET(_req: Request, ctx: RouteContext<"/api/investors/[wallet]">) {
  await live();
  const { wallet } = await ctx.params;
  return ok(read().investors[wallet.toLowerCase()] ?? null);
}

/** An investor applies for verification; the CRE KYC workflow decides. */
export async function POST(req: Request, ctx: RouteContext<"/api/investors/[wallet]">) {
  const { wallet } = await ctx.params;
  if (!isAddress(wallet)) return fail("Invalid wallet");
  const body = (await req.json()) as { name?: string; pan?: string; country?: string };
  const name = body.name?.trim();
  const pan = body.pan?.trim().toUpperCase();
  const country = body.country?.trim().toUpperCase();
  if (!name || !pan || !country) return fail("Name, PAN and country are required");

  const key = wallet.toLowerCase();
  if (read().investors[key]?.kyc?.status === "running") return fail("Verification already running", 409);

  write((d) => {
    d.investors[key] = { wallet: getAddress(wallet), name, pan, country, createdAt: Math.floor(Date.now() / 1000), kyc: null };
  });

  const run = startRun("kyc", { wallet: getAddress(wallet) }, (done) => {
    const result = done.result as KycResult | null;
    write((d) => {
      const investor = d.investors[key];
      investor.kyc = {
        runId: done.id,
        status: result ? (result.approved ? "verified" : "rejected") : "failed",
        reasons: result?.reasons,
        txHash: result?.txHash ?? undefined,
      };
    });
  });
  const investor = write((d) => {
    d.investors[key].kyc = { runId: run.id, status: "running" };
    return d.investors[key];
  });
  return ok(investor);
}
