import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

// ABIs
const USDC_ABI = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const ORACLE_ABI = [
  "function setPrice(string token, uint256 price)",
  "function getRatioShare(string baseToken, string quoteToken) view returns (uint256)"
];

const PERP_ABI = [
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function openPosition(string baseToken, string quoteToken, uint256 notional, bool isLong)",
  "function closePosition()",
  "function balances(address user) view returns (uint256)",
  "function getPositionValue(address user) view returns (int256)",
  "function positions(address user) view returns (string baseToken, string quoteToken, uint256 notional, bool isLong, uint256 entryShare)"
];

async function main() {
  // Setup provider and wallets
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL || 'http://localhost:8545');
  
  // For demo, we'll use two test wallets
  const alice = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider);
  const bob = new ethers.Wallet(process.env.BOB_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider);
  
  console.log('Demo Wallets:');
  console.log('Alice:', alice.address);
  console.log('Bob:', bob.address);
  console.log('');
  
  // Load deployment addresses
  const deploymentPath = join(__dirname, '../contracts/deployments/arbitrum.json');
  let contracts;
  
  try {
    const deploymentData = JSON.parse(readFileSync(deploymentPath, 'utf8'));
    contracts = deploymentData.contracts;
  } catch (error) {
    console.error('Error loading deployment data. Have you deployed the contracts?');
    console.error('Run: cd contracts && forge script script/Deploy.s.sol --rpc-url $ARBITRUM_RPC_URL --broadcast');
    process.exit(1);
  }
  
  // Contract instances
  const usdc = new ethers.Contract(contracts.MockUSDC, USDC_ABI, provider);
  const oracle = new ethers.Contract(contracts.RatioOracle, ORACLE_ABI, provider);
  const perp = new ethers.Contract(contracts.SimplePerp, PERP_ABI, provider);
  
  console.log('Contract Addresses:');
  console.log('USDC:', contracts.MockUSDC);
  console.log('Oracle:', contracts.RatioOracle);
  console.log('Perp:', contracts.SimplePerp);
  console.log('');
  
  // Demo flow
  console.log('=== DEMO: Relative Share Market Perpetuals ===\n');
  
  // 1. Check initial state
  console.log('1. Initial ETH/BTC ratio share:');
  const initialShare = await oracle.getRatioShare('ETH', 'BTC');
  console.log(`   ETH share: ${ethers.formatUnits(initialShare, 16)}%`);
  console.log('');
  
  // 2. Fund wallets with USDC (if needed)
  console.log('2. Funding wallets with USDC...');
  const decimals = await usdc.decimals();
  const aliceBalance = await usdc.balanceOf(alice.address);
  const bobBalance = await usdc.balanceOf(bob.address);
  
  if (aliceBalance < ethers.parseUnits('1000', decimals)) {
    console.log('   Minting USDC for Alice...');
    // Note: In real deployment, only owner can mint
  }
  
  if (bobBalance < ethers.parseUnits('1000', decimals)) {
    console.log('   Minting USDC for Bob...');
    // Note: In real deployment, only owner can mint
  }
  
  // 3. Approve and deposit
  console.log('\n3. Approving and depositing collateral...');
  await (await usdc.connect(alice).approve(perp.target, ethers.MaxUint256)).wait();
  await (await usdc.connect(bob).approve(perp.target, ethers.MaxUint256)).wait();
  
  await (await perp.connect(alice).deposit(ethers.parseUnits('1000', decimals))).wait();
  await (await perp.connect(bob).deposit(ethers.parseUnits('1000', decimals))).wait();
  
  console.log('   Alice deposited: $1000');
  console.log('   Bob deposited: $1000');
  
  // 4. Open positions
  console.log('\n4. Opening positions...');
  await (await perp.connect(alice).openPosition('ETH', 'BTC', ethers.parseUnits('1000', decimals), true)).wait();
  console.log('   Alice: LONG ETH/BTC with $1000 notional');
  
  await (await perp.connect(bob).openPosition('ETH', 'BTC', ethers.parseUnits('1000', decimals), false)).wait();
  console.log('   Bob: SHORT ETH/BTC with $1000 notional');
  
  // 5. Simulate price change
  console.log('\n5. Simulating price change...');
  console.log('   ETH price increases by 10% (from $3000 to $3300)');
  // Note: In real deployment, only authorized address can update prices
  
  // 6. Check PnL
  console.log('\n6. Checking unrealized PnL...');
  const alicePnL = await perp.getPositionValue(alice.address);
  const bobPnL = await perp.getPositionValue(bob.address);
  
  console.log(`   Alice PnL: $${ethers.formatUnits(alicePnL, decimals)}`);
  console.log(`   Bob PnL: $${ethers.formatUnits(bobPnL, decimals)}`);
  
  // 7. Close positions
  console.log('\n7. Closing positions...');
  await (await perp.connect(alice).closePosition()).wait();
  await (await perp.connect(bob).closePosition()).wait();
  
  // 8. Final balances
  console.log('\n8. Final balances:');
  const aliceFinal = await perp.balances(alice.address);
  const bobFinal = await perp.balances(bob.address);
  
  console.log(`   Alice: $${ethers.formatUnits(aliceFinal, decimals)} (${aliceFinal > ethers.parseUnits('1000', decimals) ? 'profit' : 'loss'})`);
  console.log(`   Bob: $${ethers.formatUnits(bobFinal, decimals)} (${bobFinal > ethers.parseUnits('1000', decimals) ? 'profit' : 'loss'})`);
  console.log(`   Total: $${ethers.formatUnits(aliceFinal + bobFinal, decimals)} (conserved)`);
  
  console.log('\n=== Demo Complete ===');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });