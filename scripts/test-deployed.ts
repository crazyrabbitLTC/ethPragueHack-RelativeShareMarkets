import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

// Colors for output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

// Contract ABIs
const USDC_ABI = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

const ORACLE_ABI = [
  "function setPrice(string token, uint256 price)",
  "function getRatioShare(string baseToken, string quoteToken) view returns (uint256)",
  "function owner() view returns (address)",
  "function useMockPrices() view returns (bool)"
];

const PERP_ABI = [
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function openPosition(string baseToken, string quoteToken, uint256 notional, bool isLong)",
  "function closePosition()",
  "function balances(address user) view returns (uint256)",
  "function getPositionValue(address user) view returns (int256)",
  "function positions(address user) view returns (string baseToken, string quoteToken, uint256 notional, bool isLong, uint256 entryShare)",
  "function owner() view returns (address)",
  "function pause()",
  "function unpause()",
  "function paused() view returns (bool)"
];

async function testDeployedContracts() {
  console.log(`${colors.blue}🧪 Testing Deployed Contracts on Arbitrum${colors.reset}`);
  console.log(`${colors.blue}===========================================${colors.reset}\n`);

  // Setup provider and wallets
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const alice = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY!, provider);
  const bob = new ethers.Wallet(process.env.BOB_PRIVATE_KEY!, provider);
  
  // Load deployment addresses
  const deploymentData = JSON.parse(
    readFileSync(join(__dirname, '../contracts/deployments/arbitrum.json'), 'utf8')
  );
  
  const contracts = {
    usdc: new ethers.Contract(deploymentData.contracts.MockUSDC, USDC_ABI, provider),
    oracle: new ethers.Contract(deploymentData.contracts.RatioOracle, ORACLE_ABI, provider),
    perp: new ethers.Contract(deploymentData.contracts.SimplePerpV2, PERP_ABI, provider)
  };
  
  console.log(`${colors.green}✅ Connected to contracts:${colors.reset}`);
  console.log(`USDC: ${contracts.usdc.target}`);
  console.log(`Oracle: ${contracts.oracle.target}`);
  console.log(`Perp: ${contracts.perp.target}`);
  console.log('');
  
  // Test 1: Check initial state
  console.log(`${colors.yellow}Test 1: Checking initial state...${colors.reset}`);
  
  const isPaused = await contracts.perp.paused();
  console.log(`Perp paused: ${isPaused}`);
  
  const oracleOwner = await contracts.oracle.owner();
  console.log(`Oracle owner: ${oracleOwner}`);
  
  const useMockPrices = await contracts.oracle.useMockPrices();
  console.log(`Using mock prices: ${useMockPrices}`);
  
  const ratio = await contracts.oracle.getRatioShare('ETH', 'BTC');
  console.log(`Current ETH/BTC ratio: ${ethers.formatUnits(ratio, 16)}%`);
  console.log('');
  
  // Test 2: Mint USDC to test wallets
  console.log(`${colors.yellow}Test 2: Minting USDC to test wallets...${colors.reset}`);
  
  try {
    // Check if deployer can mint (might need owner permissions)
    const mintTx1 = await contracts.usdc.connect(deployer).mint(alice.address, ethers.parseUnits('5000', 6));
    await mintTx1.wait();
    console.log(`${colors.green}✓ Minted 5000 USDC to Alice${colors.reset}`);
    
    const mintTx2 = await contracts.usdc.connect(deployer).mint(bob.address, ethers.parseUnits('5000', 6));
    await mintTx2.wait();
    console.log(`${colors.green}✓ Minted 5000 USDC to Bob${colors.reset}`);
  } catch (error: any) {
    console.log(`${colors.red}✗ Minting failed: ${error.message}${colors.reset}`);
    console.log('Checking existing balances...');
  }
  
  const aliceUSDC = await contracts.usdc.balanceOf(alice.address);
  const bobUSDC = await contracts.usdc.balanceOf(bob.address);
  console.log(`Alice USDC balance: ${ethers.formatUnits(aliceUSDC, 6)}`);
  console.log(`Bob USDC balance: ${ethers.formatUnits(bobUSDC, 6)}`);
  console.log('');
  
  // Test 3: Approve and deposit
  console.log(`${colors.yellow}Test 3: Testing deposits...${colors.reset}`);
  
  // Alice approves and deposits
  const approveTx1 = await contracts.usdc.connect(alice).approve(contracts.perp.target, ethers.MaxUint256);
  await approveTx1.wait();
  console.log(`${colors.green}✓ Alice approved Perp contract${colors.reset}`);
  
  const depositAmount = ethers.parseUnits('1000', 6);
  const depositTx1 = await contracts.perp.connect(alice).deposit(depositAmount);
  await depositTx1.wait();
  console.log(`${colors.green}✓ Alice deposited 1000 USDC${colors.reset}`);
  
  // Bob approves and deposits
  const approveTx2 = await contracts.usdc.connect(bob).approve(contracts.perp.target, ethers.MaxUint256);
  await approveTx2.wait();
  console.log(`${colors.green}✓ Bob approved Perp contract${colors.reset}`);
  
  const depositTx2 = await contracts.perp.connect(bob).deposit(depositAmount);
  await depositTx2.wait();
  console.log(`${colors.green}✓ Bob deposited 1000 USDC${colors.reset}`);
  
  // Check balances
  const aliceBalance = await contracts.perp.balances(alice.address);
  const bobBalance = await contracts.perp.balances(bob.address);
  console.log(`\nPerp balances:`);
  console.log(`Alice: ${ethers.formatUnits(aliceBalance, 6)} USDC`);
  console.log(`Bob: ${ethers.formatUnits(bobBalance, 6)} USDC`);
  console.log('');
  
  // Test 4: Open positions
  console.log(`${colors.yellow}Test 4: Opening positions...${colors.reset}`);
  
  const notional = ethers.parseUnits('500', 6); // $500 notional
  
  // Alice goes long ETH/BTC
  const openTx1 = await contracts.perp.connect(alice).openPosition('ETH', 'BTC', notional, true);
  await openTx1.wait();
  console.log(`${colors.green}✓ Alice opened LONG ETH/BTC position ($500 notional)${colors.reset}`);
  
  // Bob goes short ETH/BTC
  const openTx2 = await contracts.perp.connect(bob).openPosition('ETH', 'BTC', notional, false);
  await openTx2.wait();
  console.log(`${colors.green}✓ Bob opened SHORT ETH/BTC position ($500 notional)${colors.reset}`);
  
  // Check positions
  const alicePos = await contracts.perp.positions(alice.address);
  const bobPos = await contracts.perp.positions(bob.address);
  
  console.log(`\nPositions:`);
  console.log(`Alice: ${alicePos.isLong ? 'LONG' : 'SHORT'} ${alicePos.baseToken}/${alicePos.quoteToken}, notional: $${ethers.formatUnits(alicePos.notional, 6)}`);
  console.log(`Bob: ${bobPos.isLong ? 'LONG' : 'SHORT'} ${bobPos.baseToken}/${bobPos.quoteToken}, notional: $${ethers.formatUnits(bobPos.notional, 6)}`);
  console.log('');
  
  // Test 5: Change price and check PnL
  console.log(`${colors.yellow}Test 5: Simulating price change...${colors.reset}`);
  
  // Change ETH price (increase by 10%)
  const newETHPrice = ethers.parseUnits('3300', 18); // $3300
  const priceTx = await contracts.oracle.connect(deployer).setPrice('ETH', newETHPrice);
  await priceTx.wait();
  console.log(`${colors.green}✓ Updated ETH price to $3300 (+10%)${colors.reset}`);
  
  const newRatio = await contracts.oracle.getRatioShare('ETH', 'BTC');
  console.log(`New ETH/BTC ratio: ${ethers.formatUnits(newRatio, 16)}%`);
  
  // Check unrealized PnL
  const alicePnL = await contracts.perp.getPositionValue(alice.address);
  const bobPnL = await contracts.perp.getPositionValue(bob.address);
  
  console.log(`\nUnrealized PnL:`);
  console.log(`Alice (LONG): $${ethers.formatUnits(alicePnL, 6)}`);
  console.log(`Bob (SHORT): $${ethers.formatUnits(bobPnL, 6)}`);
  console.log('');
  
  // Test 6: Close positions
  console.log(`${colors.yellow}Test 6: Closing positions...${colors.reset}`);
  
  const closeTx1 = await contracts.perp.connect(alice).closePosition();
  await closeTx1.wait();
  console.log(`${colors.green}✓ Alice closed position${colors.reset}`);
  
  const closeTx2 = await contracts.perp.connect(bob).closePosition();
  await closeTx2.wait();
  console.log(`${colors.green}✓ Bob closed position${colors.reset}`);
  
  // Check final balances
  const aliceFinalBalance = await contracts.perp.balances(alice.address);
  const bobFinalBalance = await contracts.perp.balances(bob.address);
  
  console.log(`\nFinal balances:`);
  console.log(`Alice: $${ethers.formatUnits(aliceFinalBalance, 6)} (${aliceFinalBalance > depositAmount ? 'profit' : 'loss'})`);
  console.log(`Bob: $${ethers.formatUnits(bobFinalBalance, 6)} (${bobFinalBalance > depositAmount ? 'profit' : 'loss'})`);
  
  const totalFinal = aliceFinalBalance + bobFinalBalance;
  console.log(`Total: $${ethers.formatUnits(totalFinal, 6)} (should be ~$2000)`);
  console.log('');
  
  // Test 7: Withdrawals
  console.log(`${colors.yellow}Test 7: Testing withdrawals...${colors.reset}`);
  
  const withdrawAmount = ethers.parseUnits('500', 6);
  
  const withdrawTx1 = await contracts.perp.connect(alice).withdraw(withdrawAmount);
  await withdrawTx1.wait();
  console.log(`${colors.green}✓ Alice withdrew 500 USDC${colors.reset}`);
  
  const withdrawTx2 = await contracts.perp.connect(bob).withdraw(withdrawAmount);
  await withdrawTx2.wait();
  console.log(`${colors.green}✓ Bob withdrew 500 USDC${colors.reset}`);
  
  // Final USDC balances
  const aliceFinalUSDC = await contracts.usdc.balanceOf(alice.address);
  const bobFinalUSDC = await contracts.usdc.balanceOf(bob.address);
  
  console.log(`\nFinal USDC balances:`);
  console.log(`Alice: ${ethers.formatUnits(aliceFinalUSDC, 6)} USDC`);
  console.log(`Bob: ${ethers.formatUnits(bobFinalUSDC, 6)} USDC`);
  
  console.log(`\n${colors.green}🎉 All tests completed successfully!${colors.reset}`);
}

// Run tests
testDeployedContracts().catch((error) => {
  console.error(`${colors.red}Test failed:${colors.reset}`, error);
  process.exit(1);
});