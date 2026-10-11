import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserProvider, Contract, formatEther, getAddress, isAddress, parseEther } from 'ethers';
import abi from './generated/casino-abi.json';
import './style.css';
const chainNames = { 11155111: 'Sepolia testnet', 31337: 'Local simulation' };
const initialChain = new URLSearchParams(location.search).get('network') === 'local' ? 31337 : Number(import.meta.env.VITE_CHAIN_ID || 11155111);
const short = address => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected';
function errorText(error) {
  if (error.code === 4001 || error.code === 'ACTION_REJECTED') return 'You cancelled the request in your wallet.';
  if (error.code === 'CALL_EXCEPTION') return 'The contract rejected this action. Check the amount, round status and oracle budget. The final bet also requires a working oracle request.';
  return error.shortMessage || error.message || 'The request failed.';
}
function App() {
  const [chain, setChain] = useState(initialChain);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState('');
  const [walletChain, setWalletChain] = useState(null);
  const [address, setAddress] = useState('');
  const [data, setData] = useState(null);
  const [number, setNumber] = useState(null);
  const [amount, setAmount] = useState('');
  const [round, setRound] = useState('1');
  const [prize, setPrize] = useState(0n);
  const [outcome, setOutcome] = useState(null);
  const [funding, setFunding] = useState('0.01');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Connect your wallet and load the deployed Casino contract.');
  const [txHash, setTxHash] = useState('');
  const generation = useRef(0);
  const correctChain = walletChain === chain;
  useEffect(() => {
    generation.current++; setAddress(''); setData(null); setPrize(0n); setOutcome(null); setTxHash('');
    const saved = localStorage.getItem(`tutorial-casino-${chain}`);
    setInput(saved || (chain === 11155111 ? import.meta.env.VITE_CASINO_ADDRESS || '' : ''));
    if (chain === 31337 && !saved) {
      let active = true;
      fetch('./deployment.local.json').then(r => r.ok ? r.json() : null).then(d => { if (active && d?.chainId === 31337) setInput(d.casinoAddress); }).catch(() => {});
      return () => { active = false; };
    }
  }, [chain]);
  useEffect(() => {
    if (!window.ethereum) return;
    const reset = () => { generation.current++; setProvider(null); setAccount(''); setWalletChain(null); setAddress(''); setData(null); setPrize(0n); setOutcome(null); setBusy(false); setTxHash(''); setNotice('Your wallet account or network changed. Reconnect to continue.'); };
    window.ethereum.on('accountsChanged', reset); window.ethereum.on('chainChanged', reset);
    return () => { window.ethereum.removeListener('accountsChanged', reset); window.ethereum.removeListener('chainChanged', reset); };
  }, []);
  async function connect() {
    setBusy(true);
    try {
      if (!window.ethereum) throw new Error('Install MetaMask or a compatible browser wallet.');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts.length) throw new Error('No wallet account was selected.');
      const id = Number(await window.ethereum.request({ method: 'eth_chainId' }));
      setProvider(new BrowserProvider(window.ethereum)); setAccount(getAddress(accounts[0])); setWalletChain(id);
      setNotice(id === chain ? 'Wallet connected. Load the contract below.' : `Switch your wallet to ${chainNames[chain]}.`);
    } catch (e) { setNotice(errorText(e)); } finally { setBusy(false); }
  }
  async function switchNetwork() {
    try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + chain.toString(16) }] }); }
    catch (e) {
      if (e.code === 4902 && chain === 31337) await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x7a69', chainName: 'Assignment local simulation', rpcUrls: ['http://127.0.0.1:8545'], nativeCurrency: { name: 'Local ETH', symbol: 'ETH', decimals: 18 } }] });
      else throw e;
    }
  }
  async function read(contract) {
    const [roundId, min, max, pool, count, winner, waiting, mode, budget, entered] = await Promise.all([contract.currentRoundId(), contract.minimumBet(), contract.maxAmountOfBets(), contract.totalBet(), contract.numberOfBets(), contract.numberWinner(), contract.awaitingRandomness(), contract.oracleMode(), contract.oracleBudget(), contract.checkPlayerExists(account)]);
    if (chain === 11155111 && mode !== 'ORACLIZE_RANDOM_DS') throw new Error('Sepolia must use the production Casino, not the local proof-bypass harness.');
    return { roundId, min, max, pool, count, winner, waiting, mode, budget, entered };
  }
  async function load() {
    const epoch = generation.current; setBusy(true); setAddress(''); setData(null); setPrize(0n); setOutcome(null);
    try {
      if (!provider || !account || !correctChain) throw new Error('Connect on the selected network first.');
      if (!isAddress(input)) throw new Error('Enter a valid deployed contract address.');
      const target = getAddress(input);
      if (await provider.getCode(target) === '0x') throw new Error('No contract exists at this address.');
      const value = await read(new Contract(target, abi, provider));
      if (epoch !== generation.current) return;
      setData(value); setAddress(target); setAmount(formatEther(value.min));
      if (value.roundId > 1n) setRound(String(value.roundId - 1n));
      localStorage.setItem(`tutorial-casino-${chain}`, target);
      setNotice(value.max === 100n ? 'Contract loaded. One bet per address per round.' : `This is a ${value.max}-bet demonstration, not the required 100-bet deployment.`);
    } catch (e) { if (epoch === generation.current) setNotice(errorText(e)); } finally { if (epoch === generation.current) setBusy(false); }
  }
  async function refresh() {
    if (!provider || !address || !account || !correctChain) return;
    const epoch = generation.current;
    try {
      const contract = new Contract(address, abi, provider);
      const next = await read(contract);
      let available = 0n, completed = null;
      if (/^[1-9]\d*$/.test(round)) {
        const [value, result] = await Promise.all([contract.claimable(BigInt(round), account), contract.completedRounds(BigInt(round))]);
        available = value; if (result.settled) completed = { id: round, winner: result.winner };
      }
      if (epoch === generation.current) { setData(next); setPrize(available); setOutcome(completed); }
    } catch (e) { if (epoch === generation.current) setNotice(errorText(e)); }
  }
  useEffect(() => { refresh(); const timer = setInterval(refresh, 3000); return () => clearInterval(timer); }, [provider, address, account, walletChain, chain, round]);
  async function send(action) {
    const epoch = generation.current; setBusy(true); setTxHash('');
    try {
      if (!provider || !address || !correctChain) throw new Error('Reconnect and load the contract.');
      if (Number(await window.ethereum.request({ method: 'eth_chainId' })) !== chain) throw new Error('The wallet network changed. Reconnect.');
      const contract = new Contract(address, abi, await provider.getSigner(account));
      setNotice('Confirm the transaction in your wallet.'); const tx = await action(contract);
      if (epoch !== generation.current) return;
      setTxHash(tx.hash); setNotice('Transaction submitted. Waiting for confirmation…'); await tx.wait();
      if (epoch === generation.current) { await refresh(); setNotice('Transaction confirmed. Contract data refreshed.'); }
    } catch (e) { if (epoch === generation.current) setNotice(errorText(e)); } finally { if (epoch === generation.current) setBusy(false); }
  }
  const canBet = data && correctChain && !data.waiting && !data.entered && data.count < data.max && number && !busy;
  const validEth = text => { if (!/^\d+(\.\d{1,18})?$/.test(text)) throw new Error('Enter an ETH amount with at most 18 decimal places.'); return parseEther(text); };
  return <main>
    <header><a className="brand" href="#"><span className="brand-icon">10</span><span>Casino Lab<small>ETHEREUM ASSIGNMENT 2</small></span></a><span className="network-tag">{chainNames[chain]}</span></header>
    <section className="intro"><p className="eyebrow">THE ASSIGNED CASINO TUTORIAL</p><h1>Choose your number.<br/>Watch the round unfold.</h1><p>Choose 1–10. Each address bets once per round. The 100th bet requests Oraclize randomness; matching players share the pool equally.</p></section>
    <div className="layout"><section className="card game"><div className="section-top"><h2>Place a bet</h2><span className="phase">{data ? data.waiting ? 'Waiting for randomness' : 'Accepting bets' : 'Awaiting connection'}</span></div>
      <div className="stats"><div><span>Round</span><strong>{data ? String(data.roundId).padStart(2, '0') : '—'}</strong></div><div><span>Bets placed</span><strong>{data ? `${data.count} / ${data.max}` : '— / 100'}</strong></div><div><span>Prize pool</span><strong>{data ? formatEther(data.pool) : '—'} ETH</strong></div></div>
      <div className="progress" role="progressbar" aria-label="Bets placed" aria-valuemin={0} aria-valuemax={data ? Number(data.max) : 100} aria-valuenow={data ? Number(data.count) : 0}><div style={{ width: data ? `${Number(data.count) / Number(data.max) * 100}%` : '0%' }}/></div>
      <p className="label">Your number</p><div className="numbers">{Array.from({ length: 10 }, (_, i) => i + 1).map(n => <button key={n} disabled={busy} aria-label={`Choose number ${n}`} aria-pressed={number === n} className={number === n ? 'selected' : ''} onClick={() => setNumber(n)}>{n}</button>)}</div>
      <label htmlFor="amount">Bet amount <span>ETH</span></label><input id="amount" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" disabled={busy}/><p className="hint">Minimum {data ? formatEther(data.min) : '—'} ETH · {data?.entered ? 'You already entered this round.' : 'One entry per address per round.'}</p>
      <button className="primary" disabled={!canBet} onClick={() => send(contract => { const value = validEth(amount); if (value < data.min) throw new Error('The amount is below the minimum bet.'); return contract.bet(number, { value }); })}>{busy ? 'Waiting for wallet…' : number ? `Bet on ${number}` : 'Choose a number to bet'}</button>
      {data?.waiting && <p className="hint">The oracle request is pending. A verified callback settles this round and opens the next one.</p>}
    </section><aside><section className="card"><h2>Your connection</h2><label htmlFor="network">Network</label><select id="network" value={chain} disabled={busy} onChange={e => setChain(Number(e.target.value))}><option value={11155111}>Sepolia testnet</option><option value={31337}>Local simulation</option></select><div className="wallet-line"><span>Account</span><strong>{short(account)}</strong></div><button className="secondary" onClick={connect} disabled={busy}>{account ? 'Reconnect wallet' : 'Connect wallet'}</button>
      {account && !correctChain && <button className="secondary" onClick={() => switchNetwork().catch(e => setNotice(errorText(e)))}>Switch to {chainNames[chain]}</button>}
      <label htmlFor="contract-address">Casino contract address</label><input id="contract-address" value={input} spellCheck={false} onChange={e => setInput(e.target.value)} disabled={busy}/><button className="secondary" disabled={!account || !correctChain || busy} onClick={load}>Load contract</button>
      {data && <p className="hint">Randomness: {data.mode === 'ORACLIZE_RANDOM_DS' ? 'Oraclize random datasource with Ledger proof' : 'Local harness; Ledger proof bypassed'}</p>}
    </section><section className="card"><h2>Collect a prize</h2><label htmlFor="claim-round">Completed round</label><input id="claim-round" value={round} inputMode="numeric" onChange={e => setRound(e.target.value)} disabled={busy}/>{outcome && <div className="wallet-line"><span>Winning number · round {outcome.id}</span><strong>{String(outcome.winner)}</strong></div>}<div className="wallet-line"><span>Available prize</span><strong>{formatEther(prize)} ETH</strong></div><button className="secondary" disabled={!correctChain || prize === 0n || busy} onClick={() => send(contract => contract.claimPrize(BigInt(round), account))}>Collect prize</button></section>
      <section className="card"><h2>Oracle funding</h2><p className="hint">Separate funding pays oracle fees and keeps the players' prize pool intact. Fund it before the final bet.</p><div className="wallet-line"><span>Available budget</span><strong>{data ? formatEther(data.budget) : '—'} ETH</strong></div><label htmlFor="funding">Add test ETH</label><input id="funding" inputMode="decimal" value={funding} onChange={e => setFunding(e.target.value)} disabled={busy}/><button className="secondary" disabled={!data || !correctChain || busy} onClick={() => send(contract => { const value = validEth(funding); if (value <= 0n) throw new Error('Funding must be positive.'); return contract.fundOracle({ value }); })}>Fund oracle</button></section>
    </aside></div>
    <div className="notice" role="status" aria-live="polite">{notice}{txHash && <div>{chain === 11155111 ? <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction ↗</a> : <span className="tx-hash">Transaction: {txHash}</span>}</div>}</div>
    {chain === 31337 && <p className="simulation-note">LOCAL SIMULATION · Oracle-format requests use a test bridge. The operator supplies results and Ledger proof verification is bypassed by a separate test harness.</p>}
    <footer>Testnet coursework · Tutorial Casino with documented repairs · No-winner pools and division remainders roll over</footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
