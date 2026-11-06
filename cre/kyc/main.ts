import { cre, decodeJson, Runner, type HTTPPayload, type Runtime } from '@chainlink/cre-sdk'
import { decodeFunctionResult, encodeFunctionData, keccak256, parseAbi, toHex, type Address } from 'viem'
import { z } from 'zod'
import { fetchJson, readHedera } from '../shared/http'
import { Action, encodeVerification, sendReport } from '../shared/reports'

// Investor verification. The DON reads the investor's application and the KYC provider's record
// itself, then marks the wallet verified on Hedera. DealManager is the external KYC list of every
// ATS bond, so a verified wallet can hold any deal's units and an unverified one cannot.

const configSchema = z.object({
	appUrl: z.string(),
	mirrorUrl: z.string(),
	dealManager: z.string(),
	allowedCountries: z.array(z.string()),
	chainSelectorName: z.string(),
	relayAddress: z.string(),
	gasLimit: z.string(),
})
type Config = z.infer<typeof configSchema>

const requestSchema = z.object({ wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/) })

type Application = { wallet: Address; name: string; pan: string; country: string }
type KycRecord = { pan: string; status: 'VALID' | 'INVALID'; holderType: string; sanctionsHit: boolean; provider: string }

const managerAbi = parseAbi(['function isVerified(address) view returns (bool)'])

const onRequest = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
	const { config } = runtime
	const { wallet } = requestSchema.parse(decodeJson(payload.input))

	const app = fetchJson<Application>(runtime, `${config.appUrl}/api/investors/${wallet}/application`)
	const record = fetchJson<KycRecord>(runtime, `${config.appUrl}/api/mock/kyc/${app.pan}`)

	const reasons: string[] = []
	if (record.status !== 'VALID') reasons.push('PAN is not valid')
	if (record.holderType === 'other') reasons.push('PAN holder type cannot invest')
	if (record.sanctionsHit) reasons.push('Watchlist match')
	if (!config.allowedCountries.includes(app.country)) reasons.push(`Residence ${app.country} not supported`)
	const approved = reasons.length === 0
	runtime.log(`${app.name} (${app.pan}, ${app.country}): ${approved ? 'passes' : reasons.join('; ')}`)

	const already = decodeFunctionResult({
		abi: managerAbi,
		functionName: 'isVerified',
		data: readHedera(
			runtime,
			config.mirrorUrl,
			config.dealManager,
			encodeFunctionData({ abi: managerAbi, functionName: 'isVerified', args: [app.wallet] }),
		),
	})

	let txHash: string | null = null
	// Write only when Hedera's view has to change.
	if (approved !== already) {
		// The provider reference, not the PAN itself, goes on chain.
		const kycRef = keccak256(toHex(`${record.provider}:${app.pan}`))
		txHash = sendReport(runtime, Action.VERIFY_INVESTOR, encodeVerification(app.wallet, approved, kycRef))
		runtime.log(`Verification ${approved} written to Fuji in ${txHash}`)
	} else {
		runtime.log(`Hedera already shows verified=${already}; nothing to write`)
	}

	runtime.log(`RESULT ${JSON.stringify({ wallet: app.wallet, approved, reasons, txHash })}`)
	return approved ? 'verified' : 'rejected'
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
