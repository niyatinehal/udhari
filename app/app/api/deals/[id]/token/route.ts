import { keccak256, parseAbi, toHex, zeroAddress } from "viem";
import { dealManagerAbi } from "@/lib/abi";
import { addresses } from "@/lib/chain";
import { isinFor } from "@/lib/isin";
import { hederaClient } from "@/lib/server/hedera";
import { fail, live, ok } from "@/lib/server/respond";
import { read } from "@/lib/server/store";

const bondAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function getMaturityDate() view returns (uint256)",
]);

/** The deal's ATS bond as Hedera reports it, and the documents it stands for. */
export async function GET(_req: Request, ctx: RouteContext<"/api/deals/[id]/token">) {
  await live();
  const { id } = await ctx.params;
  const dealId = Number(id);
  try {
    const deal = await hederaClient.readContract({ address: addresses.dealManager, abi: dealManagerAbi, functionName: "getDeal", args: [BigInt(dealId)] });
    if (deal.bond === zeroAddress) return fail("Not tokenized yet", 404);
    const bond = { address: deal.bond, abi: bondAbi } as const;
    const [name, symbol, decimals, totalSupply, maturity] = await Promise.all([
      hederaClient.readContract({ ...bond, functionName: "name" }),
      hederaClient.readContract({ ...bond, functionName: "symbol" }),
      hederaClient.readContract({ ...bond, functionName: "decimals" }),
      hederaClient.readContract({ ...bond, functionName: "totalSupply" }),
      hederaClient.readContract({ ...bond, functionName: "getMaturityDate" }),
    ]);
    const bill = read().bills.find((b) => keccak256(toHex(b.irn)) === deal.docHash);
    return ok({
      address: deal.bond,
      name,
      symbol,
      decimals,
      isin: isinFor(dealId),
      totalSupply: totalSupply.toString(),
      maxSupply: deal.target.toString(),
      maturity: Number(maturity),
      docHash: deal.docHash,
      document: bill ? { name: bill.fileName, hash: bill.fileHash, url: `/api/uploads/${bill.fileHash}` } : null,
      irn: bill?.irn ?? null,
    });
  } catch (err) {
    return fail(`Could not read the bond: ${(err as Error).message.split("\n")[0]}`, 502);
  }
}
