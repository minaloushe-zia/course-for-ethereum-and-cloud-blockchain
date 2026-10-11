# Changes from the assigned Casino tutorial

Upstream source: `merlox/casino-ethereum`, commit `c23bab027e22d829fafa69a99e07ef2c89512020`, `contracts/Casino.sol`. The unchanged file is preserved as `upstream/Casino.original.sol.txt`.

Dependency: `provable-things/ethereum-api`, commit `a67a1d9bd5f57a5cc80386e2e67bbfd58d07fa14`, `old-contracts/previous-api-contracts/oraclizeAPI_0.4.sol`. This file is vendored without editing; its MIT license is retained. Its resolver selection includes a Sepolia entry, but a source-code entry does not prove the service currently fulfills requests.

| Area | Revision |
|---|---|
| Contract foundation | Keep `Casino is usingOraclize`, the original random datasource, Ledger proof type, `generateNumberWinner`, `__callback`, and hash-to-number rule |
| Import | Replace the old remote GitHub import with local `./oraclizeAPI_0.4.sol` |
| Compiler | Use 0.4.22, matching the supplement's example; explicitly declare visibility and the constructor |
| Required capacity | Require an explicit constructor setting in 1–100; use 100 in the assignment deployment rather than the tutorial's default of 10 |
| Randomness trigger | Retain automatic requesting when the final bet is accepted |
| Request tracking | Record a nonzero query ID; prevent repeated requests while awaiting a callback; reject stale or duplicate callbacks |
| Public settlement | Remove the original publicly callable prize-distribution route; accept results only through the authenticated callback with Ledger proof verification |
| Oracle fee accounting | Use separately funded oracle budget; do not deduct fees from players' pool or outstanding prizes |
| Insufficient oracle budget | Reject the final bet atomically; fund the oracle and resubmit. Prior accepted bets remain unchanged |
| Winners | Record the equal share and let each winner claim; guard against reentry and allow a different payout recipient |
| No winners and dust | Carry the pool or whole-wei remainder into the next round instead of dividing by zero or losing its accounting |
| Round reset | Key selections and claims by round so a previous player can enter again and an earlier unclaimed prize stays reserved |
| Callback gas | Request 500000 gas rather than 200000; settlement has no loop over participants. Actual public fulfillment remains to be verified |
| Frontend | Use current React, Vite and ethers wallet interfaces, while reading the tutorial-style contract fields |

The production callback keeps the dependency's `oraclize_randomDS_proofVerify` modifier. The separate test-only harness bypasses that modifier to exercise settlement without fabricating a Ledger proof. The report and UI disclose this distinction.

There is no administrator reroll or refund mechanism. A service outage before accepting the final bet prevents that bet from succeeding; an outage after a request can leave a round pending. Resolve service availability before relying on the public exercise.
