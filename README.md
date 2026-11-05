# ethglobal-mumbai (working name)

Invoice and milestone-bill financing for small businesses. Each financed bill becomes a
compliant bond on Hedera; Chainlink CRE checks the real world and its decisions reach Hedera
over CCIP from Avalanche Fuji.

```
CRE workflow ──report──► CreRelay (Fuji) ──CCIP──► DealManager (Hedera) ──► ATS bond per deal
```

## Layout

- `contracts/`: Foundry project. `src/fuji` runs on Avalanche Fuji, `src/hedera` on Hedera testnet.
- `cre/`: Chainlink CRE workflows (TypeScript).
- `app/`: web app for businesses, buyers and investors.

## Contracts

```bash
cd contracts
npm install
forge build
forge test
```
