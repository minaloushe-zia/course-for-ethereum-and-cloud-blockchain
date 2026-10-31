import { Web3 } from 'web3';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { asBlockNumber, findFirstCreation } from './src/search.mjs';

const { values } = parseArgs({
  options: {
    end: { type: 'string' },
    window: { type: 'string', default: '1024' },
    'interval-ms': { type: 'string', default: '250' },
    sequential: { type: 'boolean', default: false },
    out: { type: 'string', default: 'results' },
  },
});
const key = process.env.INFURA_API_KEY;
if (!key || !/^[a-fA-F0-9]{32}$/.test(key)) {
  console.error('Set INFURA_API_KEY in the local .env file before running the search.');
  process.exit(1);
}
const interval = Number(values['interval-ms']);
if (!Number.isFinite(interval) || interval < 0) throw new Error('Invalid request interval.');
const rpcAttempts = {};
let lastStarted = 0;

class LimitedHttpProvider extends Web3.providers.HttpProvider {
  async request(payload) {
    for (let attempt = 0; ; attempt += 1) {
      await delay(Math.max(0, lastStarted + interval - Date.now()));
      lastStarted = Date.now();
      rpcAttempts[payload.method] = (rpcAttempts[payload.method] ?? 0) + 1;
      try {
        const response = await super.request(payload, { signal: AbortSignal.timeout(30000) });
        if (response.error) {
          const error = new Error(response.error.message);
          error.rpcCode = response.error.code;
          throw error;
        }
        return response;
      } catch (error) {
        const status = error.statusCode;
        const transient = status === 429 || status >= 500 ||
          [-32005, -33200, -33300].includes(error.rpcCode) ||
          ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'].includes(error.code) ||
          error.name === 'TimeoutError' || error.name === 'AbortError';
        if (!transient || attempt >= 4) throw error;
        await delay(1000 * 2 ** attempt);
      }
    }
  }
}

const provider = new LimitedHttpProvider(`https://mainnet.infura.io/v3/${key}`);
const web3 = new Web3(provider);
const started = Date.now();
try {
  const chainId = await web3.eth.getChainId();
  if (chainId !== 1n) throw new Error('The provider must be connected to Ethereum mainnet.');
  const end = values.end === undefined
    ? asBlockNumber(await web3.eth.getBlockNumber())
    : asBlockNumber(values.end);
  console.log(`Ethereum mainnet confirmed. Searching from block 0 through ${end}.`);
  const result = await findFirstCreation({
    getFeeHistory: (count, newest) => web3.eth.getFeeHistory(count, newest, []),
    getBlock: height => web3.eth.getBlock(height, true),
  }, {
    from: 0,
    to: end,
    window: Number(values.window),
    sequential: values.sequential,
    onProgress: stats => {
      console.log(`Checked through ${stats.validatedThrough}; skipped ${stats.emptyBlocksSkipped} empty blocks; inspected ${stats.fullBlocksRead} full blocks.`);
    },
  });
  if (!result.transaction) throw new Error(`No contract-creation transaction found through block ${end}.`);
  const height = asBlockNumber(result.block.number);
  // Confirm the null recipient in Infura's original RPC representation too.
  const raw = await provider.request({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionByHash', params: [result.transaction.hash] });
  if (raw.result?.to !== null || asBlockNumber(raw.result.blockNumber) !== height) {
    throw new Error('The returned transaction did not pass the raw RPC confirmation.');
  }
  const receipt = await web3.eth.getTransactionReceipt(result.transaction.hash);
  const output = {
    chainId: '1',
    provider: 'Infura Ethereum mainnet',
    blockNumber: height,
    blockHash: result.block.hash,
    blockTimestampUTC: new Date(Number(result.block.timestamp) * 1000).toISOString(),
    transactionHash: result.transaction.hash,
    transactionIndex: asBlockNumber(result.transaction.transactionIndex),
    from: result.transaction.from,
    to: null,
    createdContractAddress: receipt.contractAddress ?? null,
    search: { ...result.stats, mode: values.sequential ? 'sequential full-block scan' : 'fee-history prefilter and ordered full-block scan' },
    rpcAttempts,
    elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(2)),
    verifiedAtUTC: new Date().toISOString(),
    blockExplorer: `https://etherscan.io/block/${height}`,
    transactionExplorer: `https://etherscan.io/tx/${result.transaction.hash}`,
  };
  await mkdir(values.out, { recursive: true });
  await writeFile(`${values.out}/first-contract.json`, JSON.stringify(output, null, 2) + '\n');
  await writeFile(`${values.out}/scan-evidence.json`, JSON.stringify(result.evidence, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error(String(error.message).replaceAll(key, '[REDACTED]'));
  process.exitCode = 1;
}
