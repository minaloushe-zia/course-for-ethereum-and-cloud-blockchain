import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
const root = path.resolve(import.meta.dirname, '..');
export function compile({ tests = true } = {}) {
  const sources = {};
  for (const name of ['contracts/Casino.sol', 'contracts/oraclizeAPI_0.4.sol', ...(tests ? ['tests/LocalHarness.sol'] : [])]) sources[name] = { content: fs.readFileSync(path.join(root, name), 'utf8') };
  const input = { language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'byzantium', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } } };
  const output = JSON.parse(solc.compileStandardWrapper(JSON.stringify(input)));
  const errors = (output.errors || []).filter(x => x.severity === 'error');
  for (const error of errors) console.error(error.formattedMessage);
  if (errors.length) throw new Error('Compilation failed');
  const artifacts = {};
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  for (const [sourceName, contracts] of Object.entries(output.contracts)) for (const [contractName, item] of Object.entries(contracts)) {
    const artifact = { sourceName, contractName, abi: item.abi, bytecode: '0x' + item.evm.bytecode.object, deployedBytecode: '0x' + item.evm.deployedBytecode.object };
    artifacts[contractName] = artifact; fs.writeFileSync(path.join(root, 'artifacts', contractName + '.json'), JSON.stringify(artifact, null, 2));
  }
  fs.writeFileSync(path.join(root, 'frontend/src/generated/casino-abi.json'), JSON.stringify(artifacts.Casino.abi, null, 2));
  fs.writeFileSync(path.join(root, 'artifacts/compiler-input.json'), JSON.stringify(input, null, 2));
  console.log(`Compiled tutorial Casino and ${Object.keys(artifacts).length - 1} dependencies/helpers with ${solc.version()}; ${(output.errors || []).length} legacy warnings.`);
  return artifacts;
}
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) compile();
