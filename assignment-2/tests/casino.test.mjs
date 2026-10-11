import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserProvider, ContractFactory, keccak256, toUtf8Bytes, ZeroHash } from 'ethers';
import { network } from 'hardhat';
import { compile } from '../scripts/compile.mjs';
import { setupBridge } from '../scripts/local-setup.mjs';
let artifacts;
const connections = [];
before(() => { artifacts = compile(); });
after(async () => { for (const connection of connections) await connection.close(); });
async function fixture(max = 100, value = 10000n, production = false) {
  const connection = await network.create(); connections.push(connection);
  const provider = new BrowserProvider(connection.provider, undefined, { cacheTimeout: -1 }); provider.pollingInterval = 10;
  const accounts = await provider.send('eth_accounts', []);
  const signers = await Promise.all(accounts.map(a => provider.getSigner(a)));
  const { oracle } = await setupBridge(provider, artifacts);
  const name = production ? 'Casino' : 'CasinoLocalHarness';
  const casino = await new ContractFactory(artifacts[name].abi, artifacts[name].bytecode, signers[0]).deploy(1000, max, { value }); await casino.waitForDeployment();
  return { provider, accounts, signers, oracle, casino };
}
async function bet(c, i, number, value = 1000n) { await (await c.casino.connect(c.signers[i]).bet(number, { value })).wait(); }
async function settle(c, number) {
  let result = '';
  for (let i = 0; ; i++) { result = 'LOCAL_TEST_' + i; if (Number(BigInt(keccak256(toUtf8Bytes(result))) % 10n) + 1 === number) break; }
  const query = await c.casino.pendingQueryId();
  await (await c.oracle.fulfill(query, result)).wait(); return query;
}
async function reverts(action) { await assert.rejects(async () => { const tx = await action(); await tx.wait(); }); }
test('configuration and betting boundaries', async () => {
  const c = await fixture();
  const f = new ContractFactory(artifacts.Casino.abi, artifacts.Casino.bytecode, c.signers[0]);
  await assert.rejects(f.deploy(0, 100)); await assert.rejects(f.deploy(1000, 101));
  await reverts(() => c.casino.bet(0, { value: 1000 })); await reverts(() => c.casino.bet(11, { value: 1000 }));
  await reverts(() => c.casino.bet(1, { value: 999 }));
  await bet(c, 0, 1); await bet(c, 1, 10);
  await reverts(() => c.casino.bet(2, { value: 1000 })); assert.equal(await c.casino.numberOfBets(), 2n);
});
test('100 distinct bets, automatic request, equal prizes and next-round entries', async () => {
  const c = await fixture(); await (await c.oracle.setPrice(100)).wait();
  for (let i = 0; i < 100; i++) await bet(c, i, i % 10 + 1, i === 0 ? 2000n : 1000n);
  assert.equal(await c.casino.awaitingRandomness(), true); assert.notEqual(await c.casino.pendingQueryId(), ZeroHash);
  assert.equal(await c.casino.oracleBudget(), 9900n); assert.equal(await c.casino.totalBet(), 101000n);
  await reverts(() => c.casino.connect(c.signers[100]).bet(1, { value: 1000 }));
  await reverts(() => c.casino.generateNumberWinner());
  const query = await settle(c, 3); await reverts(() => c.oracle.fulfill(query, 'replay'));
  assert.equal(await c.casino.currentRoundId(), 2n); assert.equal(await c.casino.numberWinner(), 3n);
  for (let i = 2; i < 100; i += 10) { assert.equal(await c.casino.claimable(1, c.accounts[i]), 10100n); await (await c.casino.connect(c.signers[i]).claimPrize(1, c.accounts[i])).wait(); }
  assert.equal(await c.casino.reservedPrizes(), 0n); assert.equal(await c.casino.oracleBudget(), 9900n);
  await reverts(() => c.casino.connect(c.signers[2]).claimPrize(1, c.accounts[2]));
  await bet(c, 0, 5); assert.equal(await c.casino.checkPlayerExists(c.accounts[0]), true);
});
test('no winner and rounding remainder roll over', async () => {
  const c = await fixture(3); await bet(c, 0, 1); await bet(c, 1, 1); await bet(c, 2, 1);
  await settle(c, 2); assert.equal(await c.casino.totalBet(), 3000n); assert.equal(await c.casino.reservedPrizes(), 0n);
  await bet(c, 0, 5); await bet(c, 1, 5); await bet(c, 2, 5, 1001n); await settle(c, 5);
  assert.equal(await c.casino.totalBet(), 1n); assert.equal(await c.casino.claimable(2, c.accounts[0]), 2000n);
});
test('oracle fees cannot consume a prize pool; funding repairs a rejected final bet', async () => {
  const c = await fixture(2, 0n); await (await c.oracle.setPrice(100)).wait(); await bet(c, 0, 1);
  await reverts(() => c.casino.connect(c.signers[1]).bet(2, { value: 1000 }));
  assert.equal(await c.casino.numberOfBets(), 1n);
  await (await c.casino.fundOracle({ value: 100 })).wait(); await bet(c, 1, 2);
  assert.equal(await c.casino.totalBet(), 2000n); assert.equal(await c.casino.oracleBudget(), 0n);
});
test('public Casino retains Ledger proof checking; local harness rejects unauthorized callbacks', async () => {
  const p = await fixture(1, 0n, true); await bet(p, 0, 1);
  await reverts(() => p.oracle.fulfill(p.casino.pendingQueryId(), 'invalid-proof'));
  assert.equal(await p.casino.awaitingRandomness(), true);
  const c = await fixture(1); await bet(c, 0, 1);
  await reverts(() => c.casino.connect(c.signers[1])['__callback(bytes32,string,bytes)'](c.casino.pendingQueryId(), 'forged', '0x'));
  await reverts(() => c.casino['__callback(bytes32,string,bytes)'](ZeroHash, 'wrong', '0x'));
});
test('a rejecting recipient can redirect a prize without losing it', async () => {
  const c = await fixture(1);
  const winner = await new ContractFactory(artifacts.TestWinner.abi, artifacts.TestWinner.bytecode, c.signers[0]).deploy(await c.casino.getAddress()); await winner.waitForDeployment();
  await (await winner.placeBet(1, { value: 1000 })).wait(); await settle(c, 1);
  await reverts(() => winner.claim(winner.getAddress()));
  assert.equal(await c.casino.claimable(1, await winner.getAddress()), 1000n);
  await (await winner.claim(c.accounts[0])).wait(); assert.equal(await c.casino.claimable(1, await winner.getAddress()), 0n);
});
test('a receiver cannot collect its prize twice by reentry', async () => {
  const c = await fixture(1);
  const winner = await new ContractFactory(artifacts.TestWinner.abi, artifacts.TestWinner.bytecode, c.signers[0]).deploy(await c.casino.getAddress()); await winner.waitForDeployment();
  await (await winner.configure(false, true)).wait(); await (await winner.placeBet(1, { value: 1000 })).wait(); await settle(c, 1);
  await (await winner.claim(await winner.getAddress())).wait(); assert.equal(await winner.reentryBlocked(), true);
  assert.equal(await c.casino.reservedPrizes(), 0n);
});
