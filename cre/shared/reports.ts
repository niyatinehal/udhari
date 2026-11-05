import {
	bytesToHex,
	cre,
	getNetwork,
	prepareReportRequest,
	TxStatus,
	type Runtime,
} from '@chainlink/cre-sdk'
import { encodeAbiParameters, parseAbiParameters, type Address, type Hex } from 'viem'

// Report actions. Must match contracts/src/shared/Actions.sol.
export const Action = {
	PING: 0,
	APPROVE_DEAL: 1,
	VERIFY_INVESTOR: 2,
	CONFIRM_REPAYMENT: 3,
	MARK_LATE: 4,
	RECONCILE: 5,
} as const

// Payload layouts decoded by DealManager on Hedera.
export const encodePing = (note: string, sentAt: bigint): Hex =>
	encodeAbiParameters(parseAbiParameters('string note, uint256 sentAt'), [note, sentAt])

export type Approval = {
	business: Address
	grade: number
	discountBps: number
	dueDate: bigint
	faceValue: bigint
	docHash: Hex
	ref: string
}

export const encodeApproval = (a: Approval): Hex =>
	encodeAbiParameters(
		parseAbiParameters(
			'address business, uint8 grade, uint16 discountBps, uint64 dueDate, uint256 faceValue, bytes32 docHash, string ref',
		),
		[a.business, a.grade, a.discountBps, a.dueDate, a.faceValue, a.docHash, a.ref],
	)

export const encodeVerification = (investor: Address, verified: boolean, kycRef: Hex): Hex =>
	encodeAbiParameters(parseAbiParameters('address investor, bool verified, bytes32 kycRef'), [
		investor,
		verified,
		kycRef,
	])

export const encodeRepayment = (dealId: bigint, amount: bigint, paymentRef: Hex): Hex =>
	encodeAbiParameters(parseAbiParameters('uint256 dealId, uint256 amount, bytes32 paymentRef'), [
		dealId,
		amount,
		paymentRef,
	])

export const encodeLate = (dealId: bigint, defaulted: boolean): Hex =>
	encodeAbiParameters(parseAbiParameters('uint256 dealId, bool defaulted'), [dealId, defaulted])

export const encodeReconciliation = (ok: boolean, offchainBalance: bigint, snapshotHash: Hex): Hex =>
	encodeAbiParameters(parseAbiParameters('bool ok, uint256 offchainBalance, bytes32 snapshotHash'), [
		ok,
		offchainBalance,
		snapshotHash,
	])

export type RelayConfig = {
	chainSelectorName: string
	relayAddress: string
	gasLimit: string
}

/**
 * Signs `abi.encode(uint8 action, bytes payload)` as a CRE report and writes it to the CreRelay
 * on Fuji, which forwards it over CCIP to the DealManager on Hedera.
 */
export const sendReport = (
	runtime: Runtime<RelayConfig>,
	action: number,
	payload: Hex,
): string => {
	const { config } = runtime
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: config.chainSelectorName,
		isTestnet: true,
	})
	if (!network) throw new Error(`Unknown network: ${config.chainSelectorName}`)
	const evm = new cre.capabilities.EVMClient(network.chainSelector.selector)

	const report = encodeAbiParameters(parseAbiParameters('uint8 action, bytes payload'), [action, payload])
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
	return bytesToHex(reply.txHash ?? new Uint8Array(32))
}
