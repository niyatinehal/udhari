// EIP-712 message a buyer signs to confirm a bill. Must match app/lib/confirmation.ts.

export const confirmationDomain = (chainId: number) =>
	({ name: 'Bill Confirmation', version: '1', chainId }) as const

export const confirmationTypes = {
	BillConfirmation: [
		{ name: 'billId', type: 'string' },
		{ name: 'ref', type: 'string' },
		{ name: 'irn', type: 'string' },
		{ name: 'seller', type: 'address' },
		{ name: 'amountPaise', type: 'uint256' },
		{ name: 'dueDate', type: 'uint64' },
		{ name: 'fileHash', type: 'bytes32' },
	],
} as const
