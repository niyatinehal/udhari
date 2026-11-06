import { getRun } from "@/lib/server/cre";
import { fail, live, ok } from "@/lib/server/respond";

export async function GET(_req: Request, ctx: RouteContext<"/api/runs/[id]">) {
  await live();
  const { id } = await ctx.params;
  const run = getRun(id);
  return run ? ok(run) : fail("Run not found", 404);
}
