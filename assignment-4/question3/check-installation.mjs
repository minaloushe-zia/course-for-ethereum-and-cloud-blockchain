import { readFileSync } from 'node:fs';
import { Web3 } from 'web3';

const metadata = JSON.parse(
  readFileSync(new URL('./node_modules/web3/package.json', import.meta.url), 'utf8'),
);
const web3 = new Web3();
if (!web3.utils.isAddress('0x0000000000000000000000000000000000000000')) {
  throw new Error('Web3.js utilities did not initialize correctly.');
}

console.log(`Node.js: ${process.version}`);
console.log(`Web3.js: ${metadata.version}`);
console.log('Web3.js import and initialization: OK');
console.log('Question 3(c) project setup: complete');
