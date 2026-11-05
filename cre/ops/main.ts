import { cre, decodeJson, Runner, type HTTPPayload, type Runtime } from '@chainlink/cre-sdk'
import { keccak256, toHex, type Address, type Hex } from 'viem'
import { z } from 'zod'
import {
	Action,
	encodeApproval,
	encodeLate,
	encodePing,
	encodeReconciliation,
	encodeRepayment,
	encodeVerification,
	sendReport,
} from '../shared/reports'

// Operator tool for testnet: sends any single report through the same Fuji -> CCIP -> Hedera
// path the product workflows use. Not part of the product flow.

const configSchema = z.object({
	chainSelectorName: z.string(),
	relayAddress: z.string(),
	gasLimit: z.string(),
})
type Config = z.infer<typeof configSchema>

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/)
const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/)
const amount = z.union([z.string(), z.number()]).transform((v) => BigInt(v))

const requestSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('ping'), note: z.string().default('ops ping') }),
	z.object({
		action: z.literal('approve'),
		business: address,
		grade: z.number().int(),
		discountBps: z.number().int(),
		dueInSeconds: z.number().int().positive(),
		faceValue: amount,
		ref: z.string(),
		docHash: bytes32.optional(),
	}),
	z.object({ action: z.literal('verify'), investor: address, verified: z.boolean().default(true) }),
	z.object({ action: z.literal('repayment'), dealId: amount, amount, paymentRef: z.string() }),
	z.object({ action: z.literal('late'), dealId: amount, defaulted: z.boolean().default(false) }),
	z.object({ action: z.literal('reconcile'), ok: z.boolean(), offchainBalance: amount }),
])

const onRequest = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
	const req = requestSchema.parse(decodeJson(payload.input))
	const now = BigInt(Math.floor(runtime.now().getTime() / 1000))
	let action: number
	let encoded: Hex

	switch (req.action) {
		case 'ping':
			action = Action.PING
			encoded = encodePing(req.note, now)
			break
		case 'approve':
			action = Action.APPROVE_DEAL
			encoded = encodeApproval({
				business: req.business as Address,
				grade: req.grade,
				discountBps: req.discountBps,
				dueDate: now + BigInt(req.dueInSeconds),
				faceValue: req.faceValue,
				docHash: (req.docHash as Hex | undefined) ?? keccak256(toHex(`${req.ref}:${now}`)),
				ref: req.ref,
			})
			break
		case 'verify':
			action = Action.VERIFY_INVESTOR
			encoded = encodeVerification(req.investor as Address, req.verified, keccak256(toHex(`ops-kyc:${req.investor}`)))
			break
		case 'repayment':
			action = Action.CONFIRM_REPAYMENT
			encoded = encodeRepayment(req.dealId, req.amount, keccak256(toHex(req.paymentRef)))
			break
		case 'late':
			action = Action.MARK_LATE
			encoded = encodeLate(req.dealId, req.defaulted)
			break
		case 'reconcile':
			action = Action.RECONCILE
			encoded = encodeReconciliation(req.ok, req.offchainBalance, keccak256(toHex(`ops-reconcile:${now}`)))
			break
	}

	const txHash = sendReport(runtime, action, encoded)
	runtime.log(`${req.action} report written to CreRelay on Fuji in ${txHash}`)
	return txHash
}

const initWorkflow = () => {
	const http = new cre.capabilities.HTTPCapability()
	return [cre.handler(http.trigger({}), onRequest)]
}

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema })
	await runner.run(initWorkflow)
}

main()
