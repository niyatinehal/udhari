import { live, ok } from "@/lib/server/respond";
import { read } from "@/lib/server/store";

export async function GET() {
  await live();
  return ok([...read().runs].reverse().slice(0, 30));
}
