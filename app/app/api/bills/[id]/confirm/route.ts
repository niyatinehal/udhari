import { getAddress, isAddress, isAddressEqual, isHex, verifyTypedData } from "viem";
import { confirmationDomain, confirmationMessage, confirmationTypes } from "@/lib/confirmation";
import { fail, ok } from "@/lib/server/respond";
import { read, write } from "@/lib/server/store";

/** The buyer's signed confirmation of the bill's terms. CRE verifies it again on its own. */
export async function POST(req: Request, ctx: RouteContext<"/api/bills/[id]/confirm">) {
  const { id } = await ctx.params;
  const { wallet, signature } = (await req.json()) as { wallet?: string; signature?: string };
  if (!wallet || !isAddress(wallet) || !signature || !isHex(signature)) {
    return fail("wallet and signature are required");
  }

  const d = read();
  const bill = d.bills.find((b) => b.id === id);
  if (!bill) return fail("Bill not found", 404);
  if (bill.confirmation) return fail("Already confirmed", 409);
  const buyerWallet = d.wallets[bill.buyer.gstin];
  if (!buyerWallet || !isAddressEqual(buyerWallet, wallet)) return fail("This wallet does not act for the buyer", 403);

  const valid = await verifyTypedData({
    address: getAddress(wallet),
    domain: confirmationDomain,
    types: confirmationTypes,
    primaryType: "BillConfirmation",
    message: confirmationMessage(bill),
    signature,
  });
  if (!valid) return fail("Signature does not match the bill");

  const updated = write((data) => {
    const b = data.bills.find((x) => x.id === id)!;
    b.confirmation = { wallet: getAddress(wallet), signature, signedAt: Math.floor(Date.now() / 1000) };
    return b;
  });
  return ok(updated);
}
