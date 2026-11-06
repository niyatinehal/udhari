import { cre, Runner, type Runtime } from '@chainlink/cre-sdk'
import { decodeFunctionResult, encodeFunctionData, keccak256, parseAbi, toHex, type Address, type Hex } from 'viem'
import { z } from 'zod'
import { readHedera } from '../shared/http'
import { Action, encodeLate, encodeReconciliation, sendReport } from '../shared/reports'

// Monitor, on a schedule. Reads every deal on Hedera through the mirror node and:
// - marks funded deals late once their due date passes (DealManager then pauses the deal's bond
//   and freezes the business), escalating to default after a grace period;
// - reconciles the stablecoin DealManager holds against what it owes holders, and trips the
//   funding circuit breaker if the money is short.

const configSchema = z.object({
	schedule: z.string(),
	mirrorUrl: z.string(),
	dealManager: z.string(),
	stablecoin: z.string(),
	defaultAfterSeconds: z.number(),
	maxReports: z.number(),
	chainSelectorName: z.string(),
	relayAddress: z.string(),
	gasLimit: z.string(),
})
type Config = z.infer<typeof configSchema>

const abi = parseAbi([
	'function dealCount() view returns (uint256)',
	'function reserved() view returns (uint256)',
	'function fundingPaused() view returns (bool)',
	'struct Deal { address business; uint8 status; uint8 grade; uint16 discountBps; uint64 dueDate; uint256 fundedAt; uint256 repaidAt; uint256 faceValue; uint256 target; uint256 funded; uint256 repaidAmount; bytes32 docHash; address bond; string ref; }',
	'function getDeal(uint256 dealId) view returns (Deal)',
	'function balanceOf(address) view returns (uint256)',
])

const ACTIVE = 3
const LATE = 5
const STATUS = ['None', 'Approved', 'Open', 'Active', 'Repaid', 'Late', 'Defaulted', 'Expired']

const onCron = (runtime: Runtime<Config>): string => {
	const { config } = runtime
	const now = BigInt(Math.floor(runtime.now().getTime() / 1000))
	const manager = config.dealManager as Address

	const call = <T>(to: Address, data: Hex, functionName: 'dealCount' | 'reserved' | 'fundingPaused' | 'getDeal' | 'balanceOf'): T =>
		decodeFunctionResult({ abi, functionName, data: readHedera(runtime, config.mirrorUrl, to, data) }) as T

	const count = call<bigint>(manager, encodeFunctionData({ abi, functionName: 'dealCount' }), 'dealCount')
	runtime.log(`${count} deals on Hedera`)

	const actions: { dealId: bigint; ref: string; defaulted: boolean }[] = []
	for (let id = 1n; id <= count; id++) {
		const d = call<{ status: number; dueDate: bigint; ref: string }>(
			manager,
			encodeFunctionData({ abi, functionName: 'getDeal', args: [id] }),
			'getDeal',
		)
		const overdue = now - d.dueDate
		runtime.log(`#${id} ${d.ref}: ${STATUS[d.status]}${overdue > 0n ? `, ${overdue}s past due` : ''}`)
		if (overdue <= 0n) continue
		const defaulted = overdue > BigInt(config.defaultAfterSeconds)
		if (d.status === ACTIVE || (d.status === LATE && defaulted)) actions.push({ dealId: id, ref: d.ref, defaulted })
	}

	const txs: string[] = []
	for (const a of actions.slice(0, config.maxReports)) {
		const tx = sendReport(runtime, Action.MARK_LATE, encodeLate(a.dealId, a.defaulted))
		runtime.log(`Marked #${a.dealId} ${a.ref} ${a.defaulted ? 'defaulted' : 'late'}; written to Fuji in ${tx}`)
		txs.push(tx)
	}

	// Reconciliation: the stablecoin balance must cover every liability DealManager tracks.
	const reserved = call<bigint>(manager, encodeFunctionData({ abi, functionName: 'reserved' }), 'reserved')
	const balance = call<bigint>(
		config.stablecoin as Address,
		encodeFunctionData({ abi, functionName: 'balanceOf', args: [manager] }),
		'balanceOf',
	)
	const paused = call<boolean>(manager, encodeFunctionData({ abi, functionName: 'fundingPaused' }), 'fundingPaused')
	const ok = balance >= reserved
	runtime.log(`Reconciliation: holds ${balance}, owes ${reserved}: ${ok ? 'covered' : 'SHORT'}`)
	if (!ok && !paused) {
		const snapshot = keccak256(toHex(`${now}:${balance}:${reserved}`))
		const tx = sendReport(runtime, Action.RECONCILE, encodeReconciliation(false, balance, snapshot))
		runtime.log(`Funding paused by reconciliation; written to Fuji in ${tx}`)
		txs.push(tx)
	}

	runtime.log(
		`RESULT ${JSON.stringify({
			deals: Number(count),
			marked: actions.map((a) => ({ dealId: Number(a.dealId), ref: a.ref, defaulted: a.defaulted })),
			balance: balance.toString(),
			reserved: reserved.toString(),
			covered: ok,
			txs,
		})}`,
	)
	return `${actions.length} marked, reserves ${ok ? 'covered' : 'short'}`
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
