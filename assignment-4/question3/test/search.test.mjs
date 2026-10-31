import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatesFromHistory, findFirstCreation, firstCreationInBlock } from '../src/search.mjs';

const tx = (index, to = '0x1234') => ({ transactionIndex: BigInt(index), hash: `0xtx${index}`, to });
const block = (height, transactions) => ({ number: BigInt(height), hash: `0xblock${height}`, transactions });

test('search proves the prefix and returns the earliest block and transaction', async () => {
  const reads = [];
  const client = {
    getFeeHistory: async (count, end) => ({
      oldestBlock: BigInt(end - count + 1),
      gasUsedRatio: Array.from({ length: count }, (_, i) => [3, 5, 9].includes(end - count + 1 + i) ? 0.5 : 0),
    }),
    getBlock: async height => {
      reads.push(height);
      return block(height, height === 5 ? [tx(2, null), tx(0, null), tx(1)] : [tx(0)]);
    },
  };
  const result = await findFirstCreation(client, { to: 11, window: 4 });
  assert.equal(result.block.number, 5n);
  assert.equal(result.transaction.transactionIndex, 0n);
  assert.deepEqual(reads, [3, 5]);
  assert.equal(result.stats.emptyBlocksSkipped, 4);
  assert.equal(result.stats.validatedThrough, 5);
});

test('truncated fee history cannot silently skip a possible earlier match', () => {
  assert.throws(() => candidatesFromHistory({ oldestBlock: 2n, gasUsedRatio: [0, 1] }, 0, 3), /Incomplete/);
});

test('zero address is a recipient and is not a null-recipient creation', () => {
  assert.equal(firstCreationInBlock(block(1, [tx(0, '0x0000000000000000000000000000000000000000')]), 1), null);
});

test('missing transaction data and mismatched block numbers fail closed', () => {
  assert.throws(() => firstCreationInBlock(block(1, ['0xhash']), 1), /Full transaction/);
  assert.throws(() => firstCreationInBlock(block(2, []), 1), /mismatched/);
});

test('a bounded range without a creation reports no match', async () => {
  const result = await findFirstCreation({
    getFeeHistory: async () => ({ oldestBlock: 0n, gasUsedRatio: [0, 0, 0] }),
    getBlock: async () => { throw new Error('An empty block should not be fetched.'); },
  }, { to: 2 });
  assert.equal(result.transaction, null);
  assert.equal(result.stats.validatedThrough, 2);
});

test('the sequential alternative inspects every earlier block without fee history', async () => {
  const reads = [];
  const result = await findFirstCreation({
    getBlock: async height => { reads.push(height); return block(height, height === 2 ? [tx(0, null)] : []); },
  }, { to: 3, sequential: true, window: 2 });
  assert.deepEqual(reads, [0, 1, 2]);
  assert.equal(result.block.number, 2n);
});

test('invalid gas ratios cannot be used as evidence for empty blocks', () => {
  assert.throws(() => candidatesFromHistory({ oldestBlock: 0n, gasUsedRatio: [NaN] }, 0, 0), /Invalid gasUsedRatio/);
});
