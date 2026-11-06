import { createPublicClient, createWalletClient, encodeFunctionData, keccak256, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { dealManagerAbi } from "../abi";
import { addresses, dealStatus, hedera, hederaTransport } from "../chain";
import { env } from "./env";
import { read } from "./store";

export const hederaClient = createPublicClient({ chain: hedera, transport: hederaTransport });

const manager = { address: addresses.dealManager, abi: dealManagerAbi } as const;

export type DealView = {
  id: number;
  status: (typeof dealStatus)[number];
  business: string;
  grade: number;
  discountBps: number;
  dueDate: number;
  fundedAt: number;
  repaidAt: number;
  faceValue: string;
  target: string;
  funded: string;
  repaidAmount: string;
  docHash: Hex;
  bond: string;
  ref: string;
  billId: string | null;
  description: string | null;
  buyer: string | null;
  buyerGstin: string | null;
  sellerGstin: string | null;
  seller: string | null;
  kind: string | null;
};

/** Every deal on Hedera, joined to its bill by the document hash (keccak256 of the IRN). */
export const listDeals = async (): Promise<DealView[]> => {
  const count = await hederaClient.readContract({ ...manager, functionName: "dealCount" });
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  const deals = await Promise.all(ids.map((id) => hederaClient.readContract({ ...manager, functionName: "getDeal", args: [id] })));
  const bills = new Map(read().bills.map((b) => [keccak256(toHex(b.irn)), b]));

  return deals.map((d, i) => {
    const bill = bills.get(d.docHash);
    return {
      id: i + 1,
      status: dealStatus[d.status],
      business: d.business,
      grade: d.grade,
      discountBps: d.discountBps,
      dueDate: Number(d.dueDate),
      fundedAt: Number(d.fundedAt),
      repaidAt: Number(d.repaidAt),
      faceValue: d.faceValue.toString(),
      target: d.target.toString(),
      funded: d.funded.toString(),
      repaidAmount: d.repaidAmount.toString(),
      docHash: d.docHash,
      bond: d.bond,
      ref: d.ref,
      billId: bill?.id ?? null,
      description: bill?.description ?? null,
      buyer: bill?.buyer.name ?? null,
      buyerGstin: bill?.buyer.gstin ?? null,
      sellerGstin: bill?.seller.gstin ?? null,
      seller: bill?.seller.name ?? null,
      kind: bill?.kind ?? null,
    };
  });
};

const operator = () => {
  const key = env("PRIVATE_KEY");
  if (!key) throw new Error("PRIVATE_KEY is not set in the repository .env");
  return createWalletClient({ account: privateKeyToAccount(key as Hex), chain: hedera, transport: hederaTransport });
};

const pendingOpens = globalThis as unknown as { pendingOpens?: Map<number, Hex> };

/**
 * Deploys the deal's ATS bond (about 7.8M gas, ~10 HBAR) from the operator account. Returns the
 * transaction hash once it is signed; the deal shows as Open when it lands. The relay can hold a
 * deployment this size open until consensus, so nothing here waits on it, and a second request
 * for the same deal is refused while one is in flight.
 */
export const openDeal = async (dealId: number): Promise<Hex> => {
  const pending = (pendingOpens.pendingOpens ??= new Map());
  if (pending.has(dealId)) throw new Error(`Already issuing in ${pending.get(dealId)}`);
  const deal = await hederaClient.readContract({ ...manager, functionName: "getDeal", args: [BigInt(dealId)] });
  if (dealStatus[deal.status] !== "Approved") throw new Error(`Deal #${dealId} is ${dealStatus[deal.status]}`);

  const wallet = operator();
  const request = await hederaClient.prepareTransactionRequest({
    account: wallet.account,
    to: addresses.dealManager,
    data: encodeFunctionData({ abi: dealManagerAbi, functionName: "openDeal", args: [BigInt(dealId)] }),
    gas: 9_000_000n,
    type: "legacy",
    gasPrice: await hederaClient.getGasPrice(),
  });
  const signed = await wallet.signTransaction(request);
  const hash = keccak256(signed);
  pending.set(dealId, hash);
  hederaClient
    .sendRawTransaction({ serializedTransaction: signed })
    .then(() => hederaClient.waitForTransactionReceipt({ hash, timeout: 300_000 }))
    .catch((err) => console.error(`openDeal ${dealId} in ${hash}:`, (err as Error).message))
    .finally(() => pending.delete(dealId));
  return hash;
};
