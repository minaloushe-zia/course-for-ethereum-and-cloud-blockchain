# Assignment 3

Zhang, Zai - Introduction to Ethereum and Cloud Blockchain Solutions Engineering

## Contents

- contracts/StorageTest.sol: question 1, original Solidity 0.5.1 contract.
- contracts/HelloWorld.sol: question 5, Solidity 0.8.30, optimizer 200 runs, Paris compiler target.
- contracts/ReentrancyLab.sol: question 6, vulnerable contract, local lab attacker and fixed contract.
- artifacts/: generated ABI, creation bytecode, runtime bytecode and Standard JSON compiler inputs.
- storage-input.json: exact 32-word input representing 1 KiB.
- evidence/: original screenshots, local receipts, observed Remix VM results and a historical Etherscan price snapshot.

## Completed Remix VM evidence

Question 1 was executed on October 20, 2026 in Remix IDE 2.6.7 using Remix VM Shanghai. StorageTest used Solidity 0.5.1, optimization disabled and compiler target Byzantium. The first put transaction cost 758,369 gas, including 732,557 gas of execution. See evidence/remix-storage-results.json and the remix-storage screenshots.

Question 5 was demonstrated by the student on October 21, 2026 in Remix IDE 2.6.8 using Remix VM Osaka. Compiler 0.8.30, optimization enabled with 200 runs, compiler target Paris. The deployed HelloWorld instance and successful hello transaction are visible in the original screenshots. The transaction cost is 23,717 gas and execution cost is 2,653 gas. readHello visibly returns Hello, world!, and the event log contains its UTF-8 bytes. See evidence/remix-hello-results-user.json and remix-hello-*-user.png.

The compiler target Paris and the VM execution hardfork Osaka are separate settings. Remix VM accounts use virtual ETH. These simulated-chain hashes have no public Etherscan pages.

## Sepolia status

Sepolia faucet funding and public deployment were not obtained. The submitted Word report states that its screenshots document Remix VM instead. The student's TA allowed submission of the current Remix screenshots; no screenshot of the private conversation is included in this package. The original assignment asks for Sepolia, so these records must not be described as public-network transactions. See evidence/sepolia-status.json.

## Reproduce the independent local tests

Install Node.js from its official distribution. In this folder run npm install and then npm test. Package versions are pinned. Ganache runs an in-process Shanghai EVM on chain ID 1337 using generated accounts and virtual ETH, without a user private key or public-network funds.

The tests verify all 32 storage words and array length, first and repeated write gas, Hello World return and event, the intentionally vulnerable local contract and the fixed contract. First storage write: 758,369 gas. Identical repeat: 101,669 gas. Hello World: 23,717 gas. In the reentrancy demonstration, 5 local ETH plus a 1 ETH attack seed are transferred out, producing 5 ETH profit before gas. The same attack against the fixed contract reverts; a normal withdrawal succeeds.

Repository: https://github.com/minaloushe-zia/course-for-ethereum-and-cloud-blockchain
