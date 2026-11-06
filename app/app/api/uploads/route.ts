import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { keccak256 } from "viem";
import { fail, ok } from "@/lib/server/respond";
import { uploadsDir, write, type Upload } from "@/lib/server/store";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

/** Stores a document and returns its keccak256 content hash, which is what goes on chain. */
export async function POST(req: Request) {
  const { name, type, data } = (await req.json()) as { name?: string; type?: string; data?: string };
  if (!name || !type || !data) return fail("name, type and data are required");
  if (!TYPES.has(type)) return fail("Upload a PDF, PNG or JPEG");
  const bytes = Buffer.from(data, "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return fail("Files must be under 5 MB");

  const hash = keccak256(bytes);
  mkdirSync(uploadsDir, { recursive: true });
  writeFileSync(path.join(uploadsDir, hash), bytes);
  const upload: Upload = { hash, name: name.slice(0, 120), type, size: bytes.length, uploadedAt: Math.floor(Date.now() / 1000) };
  write((d) => {
    d.uploads[hash] = upload;
  });
  return ok({ ...upload, url: `/api/uploads/${hash}` });
}
