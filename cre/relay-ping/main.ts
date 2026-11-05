import { cre, Runner, type Runtime } from '@chainlink/cre-sdk'
import { z } from 'zod'
import { Action, encodePing, sendReport } from '../shared/reports'

// Health check for the path CRE -> CreRelay (Fuji) -> CCIP -> DealManager (Hedera).

const configSchema = z.object({
	schedule: z.string(),
	chainSelectorName: z.string(),
	relayAddress: z.string(),
	gasLimit: z.string(),
})
type Config = z.infer<typeof configSchema>

const onCron = (runtime: Runtime<Config>): string => {
	const sentAt = BigInt(Math.floor(runtime.now().getTime() / 1000))
	const txHash = sendReport(runtime, Action.PING, encodePing('ping from CRE', sentAt))
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
