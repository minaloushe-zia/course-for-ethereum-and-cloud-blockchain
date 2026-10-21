const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { ethers } = require('ethers');
const ganache = require('ganache');
const root = path.resolve(__dirname, '..');
const artifactDir = path.join(root, 'artifacts');
const evidenceDir = path.join(root, 'evidence');
fs.mkdirSync(artifactDir, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });

function compile(packageName, filename, settings) {
  const solc = require(packageName);
  const input = {
    language: 'Solidity',
    sources: { [filename]: { content: fs.readFileSync(path.join(root, 'contracts', filename), 'utf8') } },
    settings: { ...settings, outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode', 'metadata'] } } }
  };
  const method = solc.compileStandardWrapper || solc.compile;
  const output = JSON.parse(method.call(solc, JSON.stringify(input)));
  const errors = (output.errors || []).filter(e => e.severity === 'error');
  if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  fs.writeFileSync(path.join(artifactDir, filename + '.standard-input.json'), JSON.stringify(input, null, 2));
  for (const [name, contract] of Object.entries(output.contracts[filename])) {
    const artifact = { contractName: name, compiler: solc.version(), settings, ...contract };
    fs.writeFileSync(path.join(artifactDir, name + '.json'), JSON.stringify(artifact, null, 2));
    fs.writeFileSync(path.join(artifactDir, name + '.abi.json'), JSON.stringify(contract.abi, null, 2));
    fs.writeFileSync(path.join(artifactDir, name + '.bin'), contract.evm.bytecode.object + '\n');
    fs.writeFileSync(path.join(artifactDir, name + '.bin-runtime'), contract.evm.deployedBytecode.object + '\n');
  }
  return output.contracts[filename];
}

async function main() {
  const storage = compile('solc0501', 'StorageTest.sol', { optimizer: { enabled: false, runs: 200 }, evmVersion: 'byzantium' }).StorageTest;
  const hello = compile('solc0830', 'HelloWorld.sol', { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' }).HelloWorld;
  const lab = compile('solc0424', 'ReentrancyLab.sol', { optimizer: { enabled: false, runs: 200 }, evmVersion: 'byzantium' });
  const raw = ganache.provider({
    chain: { chainId: 1337, hardfork: 'shanghai' },
    wallet: { totalAccounts: 3, defaultBalance: 100 },
    miner: { defaultGasPrice: 2000000000, blockGasLimit: 30000000 },
    logging: { quiet: true }
  });
  const provider = new ethers.BrowserProvider(raw);
  provider.pollingInterval = 10;
  const user = await provider.getSigner(0);
  const depositor = await provider.getSigner(1);
  const attackerOwner = await provider.getSigner(2);
  const deploy = async (artifact, signer, args = []) => {
    const contract = await new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, signer).deploy(...args);
    await contract.waitForDeployment();
    return contract;
  };
  const receiptJSON = receipt => JSON.parse(JSON.stringify(receipt, (_,v) => typeof v === 'bigint' ? v.toString() : v));
  const result = { measuredAt: new Date().toISOString(), environment: 'Local Ganache EVM, not Remix or Sepolia', chainId: 1337, hardfork: 'shanghai', ganacheVersion: require('ganache/package.json').version };

  const values = Array.from({ length: 32 }, (_,i) => '0x' + (i+1).toString(16).padStart(2, '0') + '00'.repeat(31));
  fs.writeFileSync(path.join(root, 'storage-input.json'), JSON.stringify(values, null, 2));
  const store = await deploy(storage, user);
  const deployment = await store.deploymentTransaction().wait();
  const put = await store.put(values);
  const putReceipt = await put.wait();
  assert.equal(putReceipt.status, 1);
  const address = await store.getAddress();
  const length = await raw.request({ method: 'eth_getStorageAt', params: [address, '0x0', 'latest'] });
  assert.equal(BigInt(length), 32n);
  const firstSlot = BigInt(ethers.keccak256(ethers.zeroPadValue('0x00',32)));
  for (let i=0; i<32; i++) {
    const value = await raw.request({method:'eth_getStorageAt',params:[address,ethers.toBeHex(firstSlot+BigInt(i)),'latest']});
    assert.equal(value.toLowerCase(), values[i]);
  }
  const bytes = ethers.getBytes(put.data);
  const nonzero = bytes.filter(v => v !== 0).length;
  const intrinsicGas = 21000 + nonzero*16 + (bytes.length-nonzero)*4;
  const trace = await raw.request({method:'debug_traceTransaction',params:[put.hash, {disableMemory:true,disableStack:true,disableStorage:true}]});
  const sstores = trace.structLogs.filter(x => x.op === 'SSTORE');
  const repeatReceipt = await (await store.put(values)).wait();
  result.storage = { contract:address, compiler:'0.5.1+commit.c8a2cb62', optimizer:false, compilerEvmVersion:'byzantium', bytesStored:1024, slotsVerified:32, lengthVerified:32, calldataBytes:bytes.length, nonzeroCalldataBytes:nonzero, intrinsicGas, sstoreCount:sstores.length, sstoreTraceCost:sstores.reduce((a,v)=>a+v.gasCost,0), firstPutGasUsed:putReceipt.gasUsed.toString(), identicalRepeatGasUsed:repeatReceipt.gasUsed.toString(), deploymentGasUsed:deployment.gasUsed.toString(), putReceipt:receiptJSON(putReceipt), deployReceipt:receiptJSON(deployment) };
  fs.writeFileSync(path.join(evidenceDir,'storage-sstore-trace.json'), JSON.stringify(sstores.map(x=>({pc:x.pc,op:x.op,gasCost:x.gasCost,depth:x.depth})),null,2));

  const hw = await deploy(hello, user);
  assert.equal(await hw.readHello(), 'Hello, world!');
  assert.equal(await hw.hello.staticCall(), 'Hello, world!');
  const helloReceipt = await (await hw.hello()).wait();
  const greeting = hw.interface.parseLog(helloReceipt.logs[0]);
  assert.equal(greeting.args.message, 'Hello, world!');
  result.helloWorld = { contract:await hw.getAddress(), compiler:'0.8.30+commit.73712a01', optimizer:true, runs:200, compilerEvmVersion:'paris', readResult:'Hello, world!', eventMessage:greeting.args.message, eventCaller:greeting.args.caller, gasUsed:helloReceipt.gasUsed.toString(), receipt:receiptJSON(helloReceipt), creationBytecodeBytes:hello.evm.bytecode.object.length/2, runtimeBytecodeBytes:hello.evm.deployedBytecode.object.length/2 };

  const victim = await deploy(lab.Dangerous, user);
  await (await victim.connect(depositor).depositMoney({value:ethers.parseEther('5')})).wait();
  const attack = await deploy(lab.ReentrancyAttacker, attackerOwner, [await victim.getAddress()]);
  const beforeOwner = BigInt(await raw.request({method:'eth_getBalance',params:[await attackerOwner.getAddress(),'latest']}));
  const attackReceipt = await (await attack.attack({value:ethers.parseEther('1'),gasLimit:3000000})).wait();
  const afterVictim = BigInt(await raw.request({method:'eth_getBalance',params:[await victim.getAddress(),'latest']}));
  const afterOwner = BigInt(await raw.request({method:'eth_getBalance',params:[await attackerOwner.getAddress(),'latest']}));
  assert.equal(afterVictim, 0n);
  const recovered = afterOwner-beforeOwner+attackReceipt.gasUsed*attackReceipt.gasPrice;
  assert.equal(recovered, ethers.parseEther('5'));
  const fixed = await deploy(lab.FixedDangerous, user);
  await (await fixed.connect(depositor).depositMoney({value:ethers.parseEther('5')})).wait();
  const fixedAttack = await deploy(lab.ReentrancyAttacker, attackerOwner, [await fixed.getAddress()]);
  let fixedRejected = false;
  try { await (await fixedAttack.attack({value:ethers.parseEther('1'),gasLimit:3000000})).wait(); }
  catch (err) { fixedRejected = true; }
  assert.equal(fixedRejected, true);
  const fixedRemaining = BigInt(await raw.request({method:'eth_getBalance',params:[await fixed.getAddress(),'latest']}));
  assert.equal(fixedRemaining, ethers.parseEther('5'));
  await (await fixed.connect(depositor).withdraw(ethers.parseEther('1'))).wait();
  assert.equal(await fixed.deposits(await depositor.getAddress()),ethers.parseEther('4'));
  result.reentrancy = { honestDepositEth:'5', attackSeedEth:'1', victimBalanceAfterEth:'0', attackerProfitBeforeGasEth:ethers.formatEther(recovered), attackGasUsed:attackReceipt.gasUsed.toString(), fixedAttackReverted:fixedRejected, fixedBalanceAfterAttackEth:ethers.formatEther(fixedRemaining), honestWithdrawalWorks:true, attackReceipt:receiptJSON(attackReceipt) };
  fs.writeFileSync(path.join(evidenceDir,'local-lab-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({ environment:result.environment,storage:{gasUsed:result.storage.firstPutGasUsed,repeatGas:result.storage.identicalRepeatGasUsed,intrinsicGas,sstores:sstores.length,sstoreTraceCost:result.storage.sstoreTraceCost},helloWorld:{gasUsed:result.helloWorld.gasUsed,output:result.helloWorld.readResult},reentrancy:result.reentrancy},null,2));
  await raw.disconnect();
}
main().catch(err => { console.error(err); process.exitCode=1; });
