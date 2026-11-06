// Copies contract ABIs from the Foundry build into the web app.
//   cd contracts && forge build && cd .. && node scripts/export-abi.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const abi = (file, name) => JSON.parse(readFileSync(`contracts/out/${file}/${name}.json`, 'utf8')).abi
const json = (value) => JSON.stringify(value, null, 2)

const dealManager = abi('DealManager.sol', 'DealManager').filter((x) => x.type !== 'constructor')
const testUsd = abi('TestUsd.sol', 'TestUsd').filter((x) => x.type !== 'constructor')
const relayEvents = abi('CreRelay.sol', 'CreRelay').filter((x) => x.type === 'event')

writeFileSync(
	'app/lib/abi.ts',
	`// Generated from contracts/out by scripts/export-abi.mjs. Do not edit by hand.

export const dealManagerAbi = ${json(dealManager)} as const

export const testUsdAbi = ${json(testUsd)} as const

export const creRelayEventsAbi = ${json(relayEvents)} as const
`,
)
