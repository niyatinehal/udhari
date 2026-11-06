import { cre, decodeJson, Runner, type HTTPPayload, type Runtime } from '@chainlink/cre-sdk'
import { decodeFunctionResult, encodeFunctionData, keccak256, parseAbi, toHex, type Address, type Hex } from 'viem'
import { z } from 'zod'
import { fetchJson, fetchMedian, readHedera } from '../shared/http'
import { Action, encodeApproval, sendReport } from '../shared/reports'

// Underwriting: decides whether a bill can be financed and on what terms. Every input is fetched
// by the DON itself (the platform's bill record, the GST e-invoice registry, a credit bureau, an
// FX rate and Hedera state), so the platform cannot push an approval through on its own say-so.
// DealManager on Hedera re-checks the policy limits before it accepts the result.
//
// The e-invoice is the seller's declaration to the GST system. In production the buyer's own
// acceptance of it, from the GST Invoice Management System (IMS), becomes one more input here.

const configSchema = z.object({
	appUrl: z.string(),
	mirrorUrl: z.string(),
	fxUrl: z.string(),
	dealManager: z.string(),
	chainSelectorName: z.string(),
	relayAddress: z.string(),
	gasLimit: z.string(),
	policy: z.object({
		maxGrade: z.number(),
		maxTenorDays: z.number(),
		minDiscountBps: z.number(),
		maxDiscountBps: z.number(),
		// Annual discount rate by grade, A first.
		annualRateBps: z.array(z.number()),
	}),
})
type Config = z.infer<typeof configSchema>

const requestSchema = z.object({ billId: z.string().regex(/^B-\d{4}$/) })

type Terms = {
	id: string
	ref: string
	irn: string
	kind: 'invoice' | 'milestone'
	seller: { gstin: string; name: string; wallet: Address }
	buyer: { gstin: string; name: string }
	amountPaise: number
	dueDate: number
	fileHash: Hex
}
type EInvoice = {
	irn: string
	status: 'ACT' | 'CNL'
	docNo: string
	sellerGstin: string
	buyerGstin: string
	totInvVal: number
}
type Seller = { gstin: string; wallet: Address; status: string; documents: { kind: string; hash: Hex }[] }
type CreditReport = { gstin: string; cmrRank: number; avgDaysLate: number; openDefaults: number }

type Check = { id: string; label: string; ok: boolean; detail: string }

const managerAbi = parseAbi([
	'function usedRef(bytes32) view returns (bool)',
	'function frozenBusiness(address) view returns (bool)',
])

const GRADES = ['A', 'B', 'C', 'D', 'E']
const DAY = 86_400

/** CMR 1 (lowest risk) to 10 maps to A..E; a buyer with open defaults or chronic late payment drops a grade. */
const gradeFor = (credit: CreditReport): number => {
	let grade = Math.min(5, Math.ceil(credit.cmrRank / 2))
	if (credit.openDefaults > 0 || credit.avgDaysLate > 30) grade = Math.min(5, grade + 1)
	return grade
}

const onRequest = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
	const { config } = runtime
	const { billId } = requestSchema.parse(decodeJson(payload.input))
	const now = Math.floor(runtime.now().getTime() / 1000)
	const checks: Check[] = []
	const check = (id: string, label: string, ok: boolean, detail: string) => {
		checks.push({ id, label, ok, detail })
		runtime.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${detail}`)
	}

	const terms = fetchJson<Terms>(runtime, `${config.appUrl}/api/bills/${billId}/terms`)
	const docHash = keccak256(toHex(terms.irn))
	runtime.log(`Underwriting ${terms.id} ${terms.ref} from ${terms.seller.name} to ${terms.buyer.name}`)

	// 1. The GST e-invoice registry knows this invoice, it is live, and it says what the bill says.
	const einvoice = fetchJson<EInvoice>(runtime, `${config.appUrl}/api/mock/irp/${terms.irn}`)
	check('einvoice', 'E-invoice is registered and active', einvoice.status === 'ACT', `IRP status ${einvoice.status}`)
	check(
		'parties',
		'Seller, buyer and number match the e-invoice',
		einvoice.sellerGstin === terms.seller.gstin &&
			einvoice.buyerGstin === terms.buyer.gstin &&
			einvoice.docNo === terms.ref,
		`${einvoice.sellerGstin} to ${einvoice.buyerGstin}, ${einvoice.docNo}`,
	)
	check(
		'amount',
		'Amount matches the e-invoice',
		Math.round(einvoice.totInvVal * 100) === terms.amountPaise,
		`registry ₹${einvoice.totInvVal}, bill ₹${terms.amountPaise / 100}`,
	)

	// 2. The seller is a verified business and the bill pays out to its registered wallet.
	const seller = fetchJson<Seller>(runtime, `${config.appUrl}/api/businesses/${terms.seller.gstin}`)
	check(
		'kyb',
		'Seller is a verified business',
		seller.status === 'verified' && seller.wallet.toLowerCase() === terms.seller.wallet.toLowerCase(),
		`${seller.status}, ${seller.documents.length} documents on file`,
	)

	// 3. Not financed before, here or through anyone using the same registry key, and the seller
	//    is in good standing. Read from Hedera through the mirror node.
	const used = decodeFunctionResult({
		abi: managerAbi,
		functionName: 'usedRef',
		data: readHedera(
			runtime,
			config.mirrorUrl,
			config.dealManager,
			encodeFunctionData({ abi: managerAbi, functionName: 'usedRef', args: [docHash] }),
		),
	})
	check('fresh', 'Not financed before', !used, used ? 'IRN already used on Hedera' : 'IRN unused on Hedera')
	const frozen = decodeFunctionResult({
		abi: managerAbi,
		functionName: 'frozenBusiness',
		data: readHedera(
			runtime,
			config.mirrorUrl,
			config.dealManager,
			encodeFunctionData({ abi: managerAbi, functionName: 'frozenBusiness', args: [terms.seller.wallet] }),
		),
	})
	check('standing', 'Seller has no late deals', !frozen, frozen ? 'seller frozen on Hedera' : 'seller in good standing')

	// 4. Tenor and buyer credit.
	const tenor = terms.dueDate - now
	check(
		'tenor',
		`Due within ${config.policy.maxTenorDays} days`,
		tenor > 0 && tenor <= config.policy.maxTenorDays * DAY,
		tenor <= 0
			? 'already due'
			: tenor < DAY
				? `due in ${Math.round(tenor / 60)} minutes`
				: `due in ${Math.round(tenor / DAY)} days`,
	)
	const credit = fetchJson<CreditReport>(runtime, `${config.appUrl}/api/mock/bureau/${terms.buyer.gstin}`)
	const grade = gradeFor(credit)
	check(
		'credit',
		'Buyer credit within policy',
		grade <= config.policy.maxGrade,
		`CMR-${credit.cmrRank}, ${credit.avgDaysLate} days late on average, ${credit.openDefaults} open defaults: grade ${GRADES[grade - 1]}`,
	)

	// 5. Price it. Investors fund the face value less a discount for the time to maturity.
	const inrPerUsd = fetchMedian(runtime, config.fxUrl, ['rates', 'INR'])
	const faceValue = BigInt(Math.floor((terms.amountPaise / 100 / inrPerUsd) * 100)) * 10_000n // whole cents, 6 decimals
	const annualRate = config.policy.annualRateBps[grade - 1]
	const discountBps = Math.min(
		config.policy.maxDiscountBps,
		Math.max(config.policy.minDiscountBps, Math.ceil((annualRate * Math.max(tenor, 0)) / (365 * DAY))),
	)

	const approved = checks.every((c) => c.ok)
	const decision = {
		billId,
		approved,
		grade,
		gradeLetter: GRADES[grade - 1],
		annualRateBps: annualRate,
		discountBps,
		inrPerUsd,
		faceValue: faceValue.toString(),
		dueDate: terms.dueDate,
		docHash,
		checks,
		txHash: null as string | null,
	}

	if (approved) {
		decision.txHash = sendReport(
			runtime,
			Action.APPROVE_DEAL,
			encodeApproval({
				business: terms.seller.wallet,
				grade,
				discountBps,
				dueDate: BigInt(terms.dueDate),
				faceValue,
				docHash,
				ref: terms.ref,
			}),
		)
		runtime.log(`Approved: grade ${GRADES[grade - 1]}, ${discountBps} bps; report written to Fuji in ${decision.txHash}`)
	} else {
		runtime.log(`Declined: ${checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`)
	}

	// The simulator truncates long log lines; checks are already logged one per line above.
	const { checks: _logged, ...summary } = decision
	runtime.log(`RESULT ${JSON.stringify(summary)}`)
	return approved ? 'approved' : 'declined'
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
