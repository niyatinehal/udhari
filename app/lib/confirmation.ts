import type { Address, Hex } from "viem";

// EIP-712 message a buyer signs to confirm a bill. Must match cre/shared/confirmation.ts,
// where the underwriting workflow recovers the signer.

export const confirmationDomain = { name: "Bill Confirmation", version: "1", chainId: 296 } as const;

export const confirmationTypes = {
  BillConfirmation: [
    { name: "billId", type: "string" },
    { name: "ref", type: "string" },
    { name: "irn", type: "string" },
    { name: "seller", type: "address" },
    { name: "amountPaise", type: "uint256" },
    { name: "dueDate", type: "uint64" },
    { name: "fileHash", type: "bytes32" },
  ],
} as const;

export type ConfirmationTerms = {
  id: string;
  ref: string;
  irn: string;
  seller: { wallet: Address };
  amountPaise: number;
  dueDate: number;
  fileHash: Hex;
};

export const confirmationMessage = (t: ConfirmationTerms) => ({
  billId: t.id,
  ref: t.ref,
  irn: t.irn,
  seller: t.seller.wallet,
  amountPaise: BigInt(t.amountPaise),
  dueDate: BigInt(t.dueDate),
  fileHash: t.fileHash,
});
