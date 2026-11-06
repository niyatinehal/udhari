# Bills (working name)

Get paid for work you have already billed.

Indian small businesses had ₹7.34 lakh crore stuck in delayed payments in March 2024. A civil
contractor waits months for a client to settle a certified milestone bill; a parts supplier waits
for a carmaker to pay an invoice. Bills turns that receivable into a bond on Hedera, verified
investors fund it, and the business is paid the moment it is fully funded. When the buyer pays,
investors redeem the face value.

Nothing is taken on the platform's word. A Chainlink CRE workflow checks the bill against the GST
e-invoice registry, verifies the buyer's signature, pulls a credit report and an FX rate, and reads
Hedera to make sure the invoice was never financed before. Its decision reaches Hedera over
Chainlink CCIP, where a contract enforces the policy again and issues an ATS bond for the deal.

## How a bill moves

1. **The business raises a bill** against an e-invoice already registered on the GST
   Invoice Registration Portal (IRP), with the due date and the signed document.
2. **The buyer confirms it** by signing the exact terms (EIP-712) with its company wallet.
3. **CRE underwrites it.** The DON fetches every input itself, so the platform cannot push an
   approval through: the bill record, the e-invoice (status, parties, amount), the buyer's
   registered wallet, a credit report, and an INR/USD rate (median across nodes). It reads Hedera
   through the mirror node to reject an invoice financed before or a seller with a late deal. It
   grades the buyer A to E and prices the discount for the time to maturity.
4. **CCIP carries the approval to Hedera** from the CRE relay on Avalanche Fuji (about 30 s).
   `DealManager` checks the grade and discount against its own limits and records the IRN hash so
   the same invoice can never be financed twice.
5. **An ATS bond is issued for the deal**: one bond per bill, `DealManager` holding every role.
   `DealManager` is also the bond's external KYC list, so only wallets CRE has verified can hold it.
6. **Investors fund it** in USD stablecoin. On full funding the business is paid in the same
   transaction.
7. **The buyer pays the face value**; holders redeem their share. If the due date passes unpaid,
   the CRE monitor marks the deal late: the bond is paused and the business frozen until it is
   cured. A deal not fully funded by its due date can be closed and refunded 1:1.

```
                    ┌──────────── Chainlink CRE (DON) ────────────┐
 web app ──HTTP──►  │ underwrite · kyc · monitor (cron)            │
 (mock IRP,         │ HTTP fetches with consensus, mirror-node     │
  bureau, KYC)      │ reads of Hedera, signed report               │
                    └───────────────┬──────────────────────────────┘
                                    │ report
                                    ▼
                  CreRelay (Avalanche Fuji) ──CCIP 2.0──► DealManager (Hedera)
                                                               │
                                                               ├─► ATS bond per deal
                                                               └─► USD stablecoin escrow
```

Why Fuji in the middle: CRE cannot write to Hedera, and CCIP connects the two. Fuji's sub-second
finality keeps CRE-to-Hedera at about 30 seconds.

## Sponsor technology

### Hedera: Asset Tokenization Studio
- `DealManager.openDeal` deploys an ATS bond per deal through the live ATS factory
  (`deployBond`), with ISIN, maturity at the due date, max supply at the funding target, and every
  role (issuer, controller, pauser, freeze manager, maturity) held by `DealManager`.
- `DealManager` implements the ATS external KYC list (`getKycStatus`); CRE's KYC workflow is what
  grants it.
- Bonds are issued on investment (`issue`), paused when late (`pause`/`unpause`) and burned on
  redemption (`controllerRedeem`).

### Chainlink CRE
Workflows in TypeScript, run with `cre workflow simulate --broadcast`, so reports are really signed
and written on Fuji:
- [`cre/underwrite`](cre/underwrite/main.ts): HTTP trigger; HTTP capability with identical and
  median consensus; EIP-712 signature recovery; Hedera reads through the mirror node; EVM write.
- [`cre/kyc`](cre/kyc/main.ts): HTTP trigger; KYC provider check; marks the wallet on Hedera.
- [`cre/monitor`](cre/monitor/main.ts): cron trigger; reads every deal and the reserves from Hedera;
  marks overdue deals late or defaulted; trips the funding circuit breaker if reserves fall short.
- [`cre/shared`](cre/shared): report encoding and the HTTP helpers.

### Chainlink CCIP 2.0
- [`CreRelay`](contracts/src/fuji/CreRelay.sol) on Fuji is the CRE report receiver and a CCIP sender:
  `ccipSend` with LINK fees and V3 extra args.
- [`DealManager`](contracts/src/hedera/DealManager.sol) on Hedera is a `CCIPReceiver` that accepts
  only the Fuji selector and the relay as sender, and dispatches each report: approve deal,
  verify investor, confirm repayment, mark late, reconcile.

## Testnet deployments

| Contract | Network | Address |
|---|---|---|
| DealManager | Hedera testnet | [`0x19723Bc95eFc5b8153B80B2E44c72D40754A1b5b`](https://hashscan.io/testnet/contract/0x19723Bc95eFc5b8153B80B2E44c72D40754A1b5b) |
| CreRelay | Avalanche Fuji | [`0xA074d972967c69BB5a0ae669e2d807b1744857b2`](https://testnet.snowtrace.io/address/0xA074d972967c69BB5a0ae669e2d807b1744857b2) |
| Test USD | Hedera testnet | [`0x9793ce270670a2cf1D72d80D3C6eAcBb4B420D9b`](https://hashscan.io/testnet/contract/0x9793ce270670a2cf1D72d80D3C6eAcBb4B420D9b) |
| ATS factory (Hedera's) | Hedera testnet | `0.0.9213391` |

Contracts are verified on Sourcify. Every address and transaction is recorded in
[`contracts/deployments/testnet.json`](contracts/deployments/testnet.json).

### One deal, end to end

Deal #3: Kavya Infra's invoice KIP/INV/26-27/034 to Arcadia Realty, ₹52,800, due in 15 minutes so
the late path could run live. Every step was driven from the web app.

| Step | Where | Transaction |
|---|---|---|
| CRE underwrites (grade A, 0.25%) and writes the report | Fuji | [`0x10170b72…`](https://testnet.snowtrace.io/tx/0x10170b72d801553f3b9b2b113e2401be5d29bee3bb0875996b7e05c87a3925b7) |
| CCIP delivers the approval | Fuji → Hedera | [`0xef9c8f53…`](https://ccip.chain.link/msg/0xef9c8f531f70c9b46fd27cbad2cf88e0f0cc55bc5f9a40639864b8cbbceb87bf) |
| ATS bond issued | Hedera | [`0x4de0f86e…`](https://hashscan.io/testnet/transaction/0x4de0f86eaaef8ce9a547ad34bfd92b37f39a1bef0bf045717fa0a68f36143dff) |
| Investor funds it; the business is paid in the same transaction | Hedera | [`0x8f56dbd3…`](https://hashscan.io/testnet/transaction/0x8f56dbd36bc94ac27f3d73fc85f83caf41a4740d21b4606f31a9dd92c22ac6f4) |
| CRE monitor finds it overdue and marks it late | Fuji | [`0x53218f1e…`](https://testnet.snowtrace.io/tx/0x53218f1e8ea8606d75a98c61583f0b8b695281cfe11706253525ca9d0d80e170) |
| CCIP delivers it: bond paused, business frozen | Fuji → Hedera | [`0x185775e6…`](https://ccip.chain.link/msg/0x185775e6cc87c228f01c845fa32c2feda4c9d9865fbe63de7735b4b2b49e3581) |
| Buyer pays late: bond unpaused, business unfrozen | Hedera | [`0x906eb32c…`](https://hashscan.io/testnet/transaction/0x906eb32c5dea08ea7c5bbaeac0d48b55f8d37112c3160032558aabc700c005fa) |
| Investor redeems; bond supply back to zero | Hedera | [`0x50f4c09c…`](https://hashscan.io/testnet/transaction/0x50f4c09c1b2603138009a0b86de16d0855c87e88546799a64ab274ffefddde9b) |

## What is real and what is a stand-in

- **Real:** the contracts, ATS bonds, CCIP messages, CRE reports written on Fuji, Hedera reads
  through the mirror node, the INR/USD rate, the buyer's EIP-712 signature.
- **Stand-ins**, served by the web app at `/api/mock/*` and fetched by CRE over HTTP exactly as
  the real services would be: the GST IRP (e-invoices by IRN), a commercial credit bureau, and a
  KYC provider. Companies and invoices are fictional.
- **Test USD** stands in for USDC on Hedera testnet, whose faucet did not deliver during the event.
- **CRE** runs in the simulator with `--broadcast`; deployment to the DON needs early access.

## Run it

Requirements: Node 20+, Foundry, Bun, the CRE CLI (`cre login`), a wallet with Hedera testnet HBAR.

```bash
# contracts
cd contracts && npm install && forge build && forge test

# CRE workflows (from cre/)
bun install

# web app
cd app && npm install && npm run dev
```

The repository-root `.env` holds the testnet key used for CRE broadcasts and bond issuance
(`PRIVATE_KEY`, `CRE_ETH_PRIVATE_KEY`, `FUJI_RPC_URL`). The app runs CRE workflows through the CLI
when a bill is underwritten or an investor applies; `scripts/cre-sim.sh <workflow> [payload]` runs
one by hand.

## Layout

- `contracts/`: Foundry. `src/fuji` (CreRelay), `src/hedera` (DealManager, ATS interfaces, ISIN),
  `src/testnet` (Test USD), `test/` (22 tests).
- `cre/`: CRE project with the underwrite, kyc, monitor, relay-ping and ops workflows.
- `app/`: Next.js app with business, buyer, investor and operations views, and the mock services.
