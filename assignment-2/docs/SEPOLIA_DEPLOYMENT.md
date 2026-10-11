# Deploy the tutorial-based Casino on Sepolia

Read-only checks on 7 October 2026 found the resolver and its oracle code, but the resolved oracle returned a zero `cbAddress` and `randomDS_getSessionPubKeyHash` reverted with `InvalidFEOpcode`. See `SEPOLIA_READ_CHECK.json`. The legacy randomness path has not passed these checks; resolve provider availability or obtain the instructor's accepted alternative before spending test ETH on this public exercise. A price response alone does not establish working randomness.

1. Obtain Sepolia test ETH and switch MetaMask to chain ID 11155111.
2. The dependency currently includes the Sepolia resolver `0x14B31A1C66a9f3D18DFaC2d123FE8cE5847b7F85`. Check that it has contract code, that `getAddress()` returns an active oracle, and that the provider offers the `random` datasource. A vendored address is not proof of current callback service. If no working provider is available, document the obstacle and ask the instructor for an accepted alternative; do not silently substitute Chainlink or a mock.
3. Upload **both** `contracts/Casino.sol` and `contracts/oraclizeAPI_0.4.sol` to Remix in the same directory. The import is relative.
4. Choose Solidity **0.4.22**, optimization enabled with **200 runs**, and **Byzantium** EVM target. Compile `Casino.sol`. Old dependency warnings are expected; compilation errors are not.
5. In Deploy & Run use **Browser Extension**, connect the Sepolia wallet, and select **Casino**. Never select `CasinoLocalHarness` or `LocalOracle` for the submitted public deployment.
6. Constructor arguments: `minimumBet = 100000000000000` wei (0.0001 test ETH), `maxAmountOfBets = 100`. Send additional test ETH with the deployment to fund oracle fees; the amount must cover the provider's quote, not a guessed fixed charge. The payable constructor treats this value as oracle funding rather than a player's bet.
7. Record the actual deployment address and receipt. Check `minimumBet`, `maxAmountOfBets` and `oracleMode`; the last must read `ORACLIZE_RANDOM_DS`.
8. Call `randomnessPrice` as a read/simulation to obtain the current quote. Check `oracleBudget` and add funds using `fundOracle` if needed. The final bet reverts if the service or its budget is unavailable.
9. Configure the real Casino address in `.env.local`:

```text
VITE_CHAIN_ID=11155111
VITE_CASINO_ADDRESS=the_actual_Casino_address
```

10. Run the web page, connect Sepolia, and place a bet. Record its transaction URL. A second entry from that address in the same round is disallowed.
11. To complete the required public round, obtain 100 distinct participating testnet addresses and sufficient test ETH. The final successful bet automatically emits `RandomnessRequested`; no separate request button is needed.
12. Record the actual callback with valid Ledger proof, `RoundSettled` event, winner and a successful `claimPrize`. A local harness result is not that evidence. A separate small-round demonstration must be labeled and does not replace the required 100-entry configuration.
13. Run `pnpm run build`; upload and pin the contents of `dist/` to IPFS. Test its actual HTTPS gateway with a wallet and record the CID and URL. Check custom-domain expectations against the assigned tutorial's scope.

Compiled public source and standard JSON input are generated in `artifacts/` for verification. No wallet private key is needed in the source or environment file. The generated local deployment JSON is not copied into the production website build.
