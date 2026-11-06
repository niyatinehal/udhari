import { companies } from "@/lib/server/mock";
import { live, ok } from "@/lib/server/respond";
import { read } from "@/lib/server/store";

export async function GET() {
  await live();
  const { wallets } = read();
  return ok(companies.map((c) => ({ ...c, wallet: wallets[c.gstin] ?? null })));
}
