import { readFileSync } from "node:fs";
import path from "node:path";
import { fail, live } from "@/lib/server/respond";
import { read, uploadsDir } from "@/lib/server/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[hash]">) {
  await live();
  const { hash } = await ctx.params;
  const upload = read().uploads[hash];
  if (!upload || !/^0x[0-9a-f]{64}$/.test(hash)) return fail("Not found", 404);
  return new Response(readFileSync(path.join(uploadsDir, hash)), {
    headers: {
      "content-type": upload.type,
      "content-disposition": `inline; filename="${upload.name.replace(/"/g, "")}"`,
    },
  });
}
