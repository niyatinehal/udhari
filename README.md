# Bills (working name)

Get paid for work you have already billed.

Indian small businesses had ₹7.34 lakh crore stuck in delayed payments in March 2024. A civil
contractor waits months for a client to settle a certified milestone bill; a parts supplier waits
for a carmaker to pay an invoice. Bills turns that receivable into a bond on Hedera, verified
investors fund it, and the business is paid the moment it is fully funded. When the buyer pays,
investors redeem the face value.

Nothing is taken on the platform's word. A Chainlink CRE workflow checks the bill against the GST
e-invoice registry, pulls the buyer's credit report and an FX rate, and reads Hedera to make sure
the invoice was never financed before. Its decision reaches Hedera over
Chainlink CCIP, where a contract enforces the policy again and issues an ATS bond for the deal.

## How a bill moves

1. **The business registers.** It enters its GSTIN, its registration comes from the GST network,
   and it uploads its KYB documents (GST certificate, PAN, cancelled cheque). Documents are stored
   by content hash.
2. **It raises a bill** against an e-invoice already registered on the GST Invoice Registration
   Portal (IRP), with the due date, and uploads the certified bill. Nothing is needed from the
   buyer: the e-invoice is the record of what it owes.
3. **CRE underwrites it.** The DON fetches every input itself, so the platform cannot push an
   approval through: the bill record, the e-invoice (status, parties, amount), the seller's
   verification, the buyer's credit report, and an INR/USD rate (median across nodes). It reads Hedera through the mirror node to
   reject an invoice financed before or a seller with a late deal. It grades the buyer A to E and
   prices the discount for the time to maturity.
4. **CCIP carries the approval to Hedera** from the CRE relay on Avalanche Fuji (about 30 s).
   `DealManager` checks the grade and discount against its own limits and records the IRN hash so
   the same invoice can never be financed twice.
5. **The bill becomes a token: an ATS bond**: one bond per bill, `DealManager` holding every role.
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
  median consensus; Hedera reads through the mirror node; EVM write.
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

Deal #6, the one in the demo video: Vedant Electricals & Controls registers from scratch, then
finances its certified RA bill 7 to Arcadia Realty, ₹1,18,000 ($1,248.18 at ₹94.54/USD), due in
15 minutes so the late path could run live. Every step was driven from the web app.

| Step | Where | Transaction |
|---|---|---|
| Vedant Electricals registers: GSTIN looked up, KYB documents uploaded | App | web app |
| CRE underwrites (8 checks, grade A, 0.25%) and writes the report | Fuji | [`0x70a17f9c…`](https://testnet.snowtrace.io/tx/0x70a17f9c5b4d89516485fdf85da9b74952d7e7329e314af51f03c7e2a579c2bf) |
| CCIP delivers the approval | Fuji → Hedera | [`0xea3d125e…`](https://ccip.chain.link/msg/0xea3d125e2f406bf2337415c5518a3b7bc720e3133c93d9fca01f3765ca24aa6b) |
| The bill becomes ATS bond BILL6 (ISIN ZZ0000000065) | Hedera | [`0xa932b8c2…`](https://hashscan.io/testnet/transaction/0xa932b8c28a177009499e354556299ba41245b35c6e094b0ccf2c45c55986f41f) |
| CRE verifies the investor | Fuji → Hedera | [`0x625e9094…`](https://ccip.chain.link/msg/0x625e9094b74ae488556582be5c8ba5bd4390f1f307e07137bf110dc8e467fc59) |
| Investor funds it; the business is paid in the same transaction | Hedera | [`0xb64ca93b…`](https://hashscan.io/testnet/transaction/0xb64ca93b615225a3b2c063dafda245742ff3a9935de016bf0fa52047bd806353) |
| CRE monitor finds it overdue and marks it late | Fuji | [`0x47292165…`](https://testnet.snowtrace.io/tx/0x4729216562ea8dcc4b8e0b1704746b9b5eeae17f5f121c4e9cc160159f095a90) |
| CCIP delivers it: bond paused, business frozen | Fuji → Hedera | [`0x84ce6055…`](https://ccip.chain.link/msg/0x84ce6055e05330b4c3d97d40abbf13edb7ae5621117752baf9a800c0a4bd25ba) |
| Buyer pays late: bond unpaused, business unfrozen | Hedera | [`0x90530124…`](https://hashscan.io/testnet/transaction/0x90530124af72910cdeb2d4e27cbf94b139a9f847e5fd94a36a7a513c393c3982) |
| Investor redeems; bond supply back to zero | Hedera | [`0x57ccb80e…`](https://hashscan.io/testnet/transaction/0x57ccb80e7ce67169f823d17e4a94e76c17a498176da02a138aff3d651da06d61) |

## What is real and what is a stand-in

- **Real:** the contracts, ATS bonds, CCIP messages, CRE reports written on Fuji, Hedera reads
  through the mirror node, the INR/USD rate.
- **Stand-ins**, served by the web app at `/api/mock/*` and fetched by CRE over HTTP exactly as
  the real services would be: the GST IRP (e-invoices by IRN), a commercial credit bureau, and a
  KYC provider. Companies and invoices are fictional.
- **Test USD** stands in for USDC on Hedera testnet, whose faucet did not deliver during the event.
- **CRE** runs in the simulator with `--broadcast`; deployment to the DON needs early access.

## In production

- **Buyer acceptance from the GST system.** An e-invoice is the seller's declaration. Since
  October 2024 buyers accept or reject each supplier invoice in the GST Invoice Management System
  (IMS) to claim input tax credit; CRE adds that acceptance as an underwriting input, so the buyer
  never has to join the platform.
- **Repayment to the deal.** The financed e-invoice names the deal's collection account in its
  payment details, so the buyer's normal payment lands with investors.
- **Business verification (KYB)** when a seller onboards, alongside investor KYC.
- **USDC** in place of Test USD, and CRE deployed to the DON with its cron monitor running on
  schedule.

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
