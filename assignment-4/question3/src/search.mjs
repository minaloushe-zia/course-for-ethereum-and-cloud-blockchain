export function asBlockNumber(value) {
  const number = typeof value === 'number' ? value : Number(BigInt(value));
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error('A block number must be a nonnegative safe integer.');
  }
  return number;
}

export function candidatesFromHistory(history, from, to) {
  const ratios = history?.gasUsedRatio;
  if (asBlockNumber(history?.oldestBlock) !== from ||
      !Array.isArray(ratios) || ratios.length !== to - from + 1) {
    throw new Error(`Incomplete fee history for blocks ${from}-${to}; no blocks were skipped.`);
  }
  if (ratios.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error('Invalid gasUsedRatio in the fee history response.');
  }
  return ratios.flatMap((value, index) => value > 0 ? [from + index] : []);
}

export function firstCreationInBlock(block, expectedNumber) {
  if (!block || asBlockNumber(block.number) !== expectedNumber || !Array.isArray(block.transactions)) {
    throw new Error(`Missing or mismatched block ${expectedNumber}.`);
  }
  for (const tx of block.transactions) {
    if (!tx || typeof tx !== 'object' || typeof tx.hash !== 'string' ||
        !Object.hasOwn(tx, 'to') || (tx.to !== null && typeof tx.to !== 'string')) {
      throw new Error(`Full transaction objects are required for block ${expectedNumber}.`);
    }
  }
  return [...block.transactions]
    .sort((a, b) => asBlockNumber(a.transactionIndex) - asBlockNumber(b.transactionIndex))
    .find(tx => tx.to === null) ?? null;
}

// A zero gas-used ratio means gasUsed is zero. A transaction necessarily uses
// positive intrinsic gas, so these blocks cannot contain creation transactions.
// All positive-gas blocks are inspected in increasing block-number order.
export async function findFirstCreation(client, {
  from = 0,
  to,
  window = 1024,
  sequential = false,
  onProgress = () => {},
} = {}) {
  from = asBlockNumber(from);
  to = asBlockNumber(to);
  if (from > to || !Number.isInteger(window) || window < 1 || window > 1024) {
    throw new Error('Invalid search range or history window.');
  }
  const evidence = { historyRanges: [], inspectedBlocks: [] };
  const stats = { startBlock: from, validatedThrough: from - 1, emptyBlocksSkipped: 0, fullBlocksRead: 0 };
  for (let start = from; start <= to; start += window) {
    const end = Math.min(to, start + window - 1);
    let candidates;
    if (sequential) {
      candidates = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    } else {
      const history = await client.getFeeHistory(end - start + 1, end);
      candidates = candidatesFromHistory(history, start, end);
      evidence.historyRanges.push({ from: start, to: end, returnedBlocks: end - start + 1, positiveGasBlocks: candidates });
    }
    let cursor = start;
    for (const height of candidates) {
      if (!sequential) stats.emptyBlocksSkipped += height - cursor;
      const block = await client.getBlock(height);
      const creation = firstCreationInBlock(block, height);
      stats.fullBlocksRead += 1;
      evidence.inspectedBlocks.push({
        number: height,
        hash: block.hash,
        transactions: block.transactions.map(tx => ({ hash: tx.hash, to: tx.to, index: asBlockNumber(tx.transactionIndex) })),
      });
      stats.validatedThrough = height;
      if (creation) return { block, transaction: creation, stats, evidence };
      cursor = height + 1;
    }
    if (!sequential) stats.emptyBlocksSkipped += end + 1 - cursor;
    stats.validatedThrough = end;
    onProgress({ ...stats });
  }
  return { block: null, transaction: null, stats, evidence };
}
