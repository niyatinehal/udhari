import { listDeals } from "@/lib/server/hedera";
import { fail, live, ok } from "@/lib/server/respond";

export async function GET() {
  await live();
  try {
    return ok(await listDeals());
  } catch (err) {
    return fail(`Could not read Hedera: ${(err as Error).message}`, 502);
  }
}
