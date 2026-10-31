# Assignment 4 Question 3

This Node.js project uses Web3.js and an Infura Ethereum mainnet provider to find the earliest transaction whose recipient is null. It scans from block zero and does not contain a hardcoded answer.

## Question 3b Infura

The account uses Ethereum Mainnet. The endpoint format is https://mainnet.infura.io/v3/YOUR_API_KEY.

## Question 3c Project setup

The project declares Web3.js 4.16.0 as a dependency in package.json. The package lock records the installed dependency versions. JavaScript files use native ECMAScript modules. Node.js 20.6 or later is required; the recorded run used Node.js 25.7.0 and npm 11.10.1.

To install the dependencies from this folder:

```powershell
npm ci
```

To verify the installation:

```powershell
npm run check
```

The check imports Web3.js, creates an instance and verifies that its address utility is available. It prints the installed Node.js and Web3.js versions.

## Infura configuration

Copy .env.example to .env and replace the placeholder with your Infura API key.

On Windows, create the local configuration with:

```powershell
Copy-Item .env.example .env
notepad .env
```

## Question 3d Run the search

```powershell
npm run find
```

The recorded result is block **46402**, transaction index **0**, at **2015-08-07 04:42:15 UTC**.

Transaction hash:

```text
0x6c929e1c3d860ee225d7f3a7addf9e3f740603d243260536dfa2f3cf02b51de4
```

The recipient is null. The receipt identifies the created address as 0x9a049f5d18c239efaa258af9f3e7002949a977a0. The task's criterion is a contract-creation transaction, irrespective of whether its deployed runtime code is useful or nonempty.

The program writes the result to results/first-contract.json and the inspected prefix to results/scan-evidence.json. Inspect the [transaction on Etherscan](https://etherscan.io/tx/0x6c929e1c3d860ee225d7f3a7addf9e3f740603d243260536dfa2f3cf02b51de4).

### How the search establishes the earliest result

1. Confirm Ethereum mainnet, chain ID 1.
2. Read eth_feeHistory in ascending windows of up to 1024 blocks. Validate oldestBlock and the returned array length so that a partial response cannot silently omit earlier blocks.
3. Skip blocks whose gasUsedRatio is exactly zero. They use zero gas, whereas a transaction requires positive intrinsic gas.
4. Fetch every remaining block with full transaction objects, in ascending block order. Within a block, sort by transactionIndex and select the first transaction whose to field is strictly null.
5. Confirm the selected transaction through eth_getTransactionByHash and retrieve its receipt.

The recorded run covered blocks 0 through 46402 inclusive: 46,324 zero-gas blocks and 79 full blocks. It made 46 history requests and 79 full-block requests, plus four confirmation/network requests, for 129 RPC calls total. It completed in 43.93 seconds. The default 250 ms request interval and bounded retries limit throughput; results will vary with network conditions.

### Alternatives and tests

```powershell
npm test
npm run find -- --end 50000
npm run find -- --sequential --end 50000
```

The sequential option reads every block and provides a straightforward alternative when fee history is unavailable. It uses substantially more RPC calls. A truncated or malformed fee history response causes the optimized search to stop instead of claiming a complete prefix.

Seven offline tests cover earliest-block ordering, earliest-transaction ordering, incomplete history, invalid ratios, null versus the zero address, invalid block data, no-match ranges, and the sequential alternative.

## Question 3e Execution speed

The implemented improvement is the history prefilter followed by full-transaction block requests. It avoids one request per empty block and one extra request per transaction. Further improvements could include cached progress and bounded concurrent or batched reads, while respecting the provider's throughput limits and ensuring that every earlier candidate block has been checked. Binary search on whether a single block contains a creation is invalid because that condition is not monotonic.

## References

- [Web3.js quickstart](https://docs.web3js.org/guides/getting_started/quickstart/)
- [Infura getting started](https://docs.infura.io/get-started/infura/)
- [Infura eth_feeHistory](https://docs.infura.io/reference/ethereum/json-rpc-methods/eth_feehistory/)
- [Ethereum JSON-RPC specification](https://ethereum.org/developers/docs/apis/json-rpc/)
