# Assignment 2 Casino tutorial implementation

This revision uses the assigned tutorial's Casino as its starting point, imports the supplied `oraclizeAPI_0.4.sol` from the original provider's repository, and retains the Oraclize random datasource and Ledger proof verification. It supersedes the earlier Chainlink adaptation for this assignment. The unchanged upstream Casino, dependency license, source commit identifiers and a change list are included for review.

The submitted configuration is 100 bets per round, numbers 1–10, and one entry per address per round. The final bet requests randomness automatically. Winners receive equal shares through individual claims. No-winner pools and integer division remainders carry into the next round.

## Run and verify

Node.js 22.12 or newer and pnpm 11 are required.

```text
pnpm install --frozen-lockfile
pnpm test
pnpm run build
```

The compiler is Solidity 0.4.22, optimizer enabled with 200 runs, Byzantium EVM target. Legacy compiler warnings are expected from the original dependency; errors must still be resolved. The frontend uses React and ethers with the current browser-wallet API, avoiding the tutorial's discontinued injected `web3` assumption.

For local testing, start a fresh node in one terminal:

```text
pnpm run chain
```

In a second terminal:

```text
pnpm run deploy:local
pnpm run dev
```

Open `http://127.0.0.1:5173/?network=local`. The network ID is 31337 and the RPC is `http://127.0.0.1:8545`. Use a disposable development wallet. `pnpm run demo:local` completes a fresh 100-address round automatically.

The local bridge and `CasinoLocalHarness` are test helpers. The harness deliberately skips Ledger proof verification, and the web page labels it as a simulation. It cannot be used as evidence of a real oracle callback; the UI rejects that mode on Sepolia. Deploy `Casino` from `contracts/Casino.sol` for the public exercise, not a contract from `tests/`.

## Deployment and submission

Follow [中文运行与提交说明](docs/使用与提交说明.md) and [Sepolia deployment](docs/SEPOLIA_DEPLOYMENT.md). The PDF report must be named `Assignment 2 - Zhang Zai-Zia.pdf`, as specified by the student. A fixed GitHub repository name is not specified in the supplied assignment.

Public deployment, real Ledger proof/callback verification, IPFS publication, GitHub upload, and LMS submission remain separate external steps. Their actual addresses, receipts and URLs must be recorded after completion. See [verification](docs/VERIFICATION.md) for completed local checks.

## Source and changes

Original tutorial Casino: [merlox/casino-ethereum](https://github.com/merlox/casino-ethereum/blob/c23bab027e22d829fafa69a99e07ef2c89512020/contracts/Casino.sol).

Oraclize dependency: [original provider repository](https://github.com/provable-things/ethereum-api/blob/a67a1d9bd5f57a5cc80386e2e67bbfd58d07fa14/old-contracts/previous-api-contracts/oraclizeAPI_0.4.sol). The root path shown in the supplement has moved to `old-contracts/previous-api-contracts`; the vendored dependency retains its original contents and copyright/license text.

[Documented repairs and compatibility updates](docs/CHANGES.md) distinguish this source-based revision from an unchanged copy. The assignment does not explicitly require byte-for-byte identity; do not describe the modified file as the unmodified original.
