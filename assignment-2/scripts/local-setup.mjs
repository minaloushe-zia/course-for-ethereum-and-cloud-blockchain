import { Contract, ContractFactory } from 'ethers';
export const bridgeAddress = '0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475';
export async function setupBridge(provider, artifacts) {
  if ((await provider.getNetwork()).chainId !== 31337n) throw new Error('Local chain only');
  const signer = await provider.getSigner(0);
  const oracle = await new ContractFactory(artifacts.LocalOracle.abi, artifacts.LocalOracle.bytecode, signer).deploy();
  await oracle.waitForDeployment();
  await provider.send('hardhat_setCode', [bridgeAddress, artifacts.LocalResolver.deployedBytecode]);
  const bridge = new Contract(bridgeAddress, artifacts.LocalResolver.abi, signer);
  // This may only initialize a fresh node, never replace an existing resolver.
  await (await bridge.setAddress(await oracle.getAddress())).wait();
  return { signer, oracle };
}
