import { startRun } from "@/lib/server/cre";
import { fail, ok } from "@/lib/server/respond";
import { read, write, type Decision } from "@/lib/server/store";

/** Starts the CRE underwriting workflow for a bill. */
export async function POST(_req: Request, ctx: RouteContext<"/api/bills/[id]/underwrite">) {
  const { id } = await ctx.params;
  const bill = read().bills.find((b) => b.id === id);
  if (!bill) return fail("Bill not found", 404);
  const status = bill.underwriting?.status;
  if (status === "running" || status === "approved") return fail("Already underwritten", 409);

  const run = startRun("underwrite", { billId: id }, (done) => {
    const decision = done.result as Decision | null;
    write((d) => {
      const b = d.bills.find((x) => x.id === id)!;
      b.underwriting = {
        runId: done.id,
        status: decision ? (decision.approved ? "approved" : "declined") : "failed",
        decision: decision ?? undefined,
      };
    });
  });
  write((d) => {
    d.bills.find((x) => x.id === id)!.underwriting = { runId: run.id, status: "running" };
  });
  return ok(run);
}
