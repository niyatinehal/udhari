import {
	consensusIdenticalAggregation,
	consensusMedianAggregation,
	cre,
	json,
	ok,
	text,
	type HTTPSendRequester,
	type Runtime,
} from '@chainlink/cre-sdk'
import type { Hex } from 'viem'

// Every node in the DON makes these requests itself; consensus decides what the workflow sees.

const getText = (requester: HTTPSendRequester, url: string): string => {
	const res = requester.sendRequest({ url, method: 'GET' }).result()
	if (!ok(res)) throw new Error(`GET ${url} returned ${res.statusCode}`)
	return text(res)
}

/** GET a JSON document. Nodes must receive identical bytes. */
export const fetchJson = <T>(runtime: Runtime<unknown>, url: string): T => {
	const http = new cre.capabilities.HTTPClient()
	const body = http.sendRequest(runtime, getText, consensusIdenticalAggregation<string>())(url).result()
	return JSON.parse(body) as T
}

/** GET a JSON document and read one number from it. Nodes may differ; the median wins. */
export const fetchMedian = (runtime: Runtime<unknown>, url: string, path: string[]): number => {
	const read = (requester: HTTPSendRequester, target: string): number => {
		let value: unknown = JSON.parse(getText(requester, target))
		for (const key of path) value = (value as Record<string, unknown>)[key]
		if (typeof value !== 'number') throw new Error(`${path.join('.')} missing from ${target}`)
		return value
	}
	const http = new cre.capabilities.HTTPClient()
	return http.sendRequest(runtime, read, consensusMedianAggregation<number>())(url).result()
}

const mirrorCall = (requester: HTTPSendRequester, url: string, to: string, data: string): string => {
	const body = Buffer.from(JSON.stringify({ to, data, block: 'latest' })).toString('base64')
	const res = requester
		.sendRequest({ url, method: 'POST', headers: { 'content-type': 'application/json' }, body })
		.result()
	if (!ok(res)) throw new Error(`mirror node call to ${to} returned ${res.statusCode}: ${text(res)}`)
	return (json(res) as { result: string }).result
}

/**
 * Read Hedera contract state. CRE has no Hedera chain reader, so this goes through the Hedera
 * mirror node's `contracts/call` endpoint (an eth_call against the latest state).
 */
export const readHedera = (runtime: Runtime<unknown>, mirrorUrl: string, to: string, data: Hex): Hex => {
	const http = new cre.capabilities.HTTPClient()
	const url = `${mirrorUrl}/api/v1/contracts/call`
	return http.sendRequest(runtime, mirrorCall, consensusIdenticalAggregation<string>())(url, to, data).result() as Hex
}
