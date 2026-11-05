import {
	bytesToHex,
	cre,
	getNetwork,
	prepareReportRequest,
	Runner,
	TxStatus,
	type Runtime,
} from '@chainlink/cre-sdk'
import { encodeAbiParameters, parseAbiParameters, type Hex } from 'viem'
import { z } from 'zod'

// Proves the path CRE -> CreRelay (Fuji) -> CCIP -> DealManager (Hedera) with a ping report.

const configSchema = z.object({
	schedule: z.string(),
	chainSelectorName: z.string(),
	relayAddress: z.string(),
	gasLimit: z.string(),
})
type Config = z.infer<typeof configSchema>

const ACTION_PING = 0

const onCron = (runtime: Runtime<Config>): string => {
	const { config } = runtime
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: config.chainSelectorName,
		isTestnet: true,
	})
	if (!network) throw new Error(`Unknown network: ${config.chainSelectorName}`)
	const evm = new cre.capabilities.EVMClient(network.chainSelector.selector)

	const sentAt = BigInt(Math.floor(runtime.now().getTime() / 1000))
	const payload = encodeAbiParameters(parseAbiParameters('string note, uint256 sentAt'), [
		'ping from CRE',
		sentAt,
	])
	const report: Hex = encodeAbiParameters(parseAbiParameters('uint8 action, bytes payload'), [
		ACTION_PING,
		payload,
	])

	const signed = runtime.report(prepareReportRequest(report)).result()
	const reply = evm
		.writeReport(runtime, {
			receiver: config.relayAddress,
			report: signed,
			gasConfig: { gasLimit: config.gasLimit },
		})
		.result()

	if (reply.txStatus !== TxStatus.SUCCESS) {
		throw new Error(`Report write failed: ${reply.errorMessage ?? reply.txStatus}`)
	}
	const txHash = bytesToHex(reply.txHash ?? new Uint8Array(32))
	runtime.log(`Ping sent at ${sentAt}, written to CreRelay on Fuji in ${txHash}`)
	return txHash
}

const initWorkflow = (config: Config) => {
	const cron = new cre.capabilities.CronCapability()
	return [cre.handler(cron.trigger({ schedule: config.schedule }), onCron)]
}

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema })
	await runner.run(initWorkflow)
}

main()
