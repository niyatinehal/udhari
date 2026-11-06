import { startRun } from "@/lib/server/cre";
import { ok } from "@/lib/server/respond";

/** Runs the CRE monitor once (it also runs on its cron schedule when deployed). */
export async function POST() {
  return ok(startRun("monitor", null));
}
