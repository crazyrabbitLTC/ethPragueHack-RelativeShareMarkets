const { ethers } = require('ethers');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Contract ABIs
const ORACLE_ABI = [
  "function setPrice(string token, uint256 price)",
  "function getRatioShare(string baseToken, string quoteToken) view returns (uint256)"
];

const PERP_ABI = [
  "function openPosition(string baseToken, string quoteToken, uint256 notional, bool isLong)",
  "function closePosition()",
  "function balances(address user) view returns (uint256)",
  "function getPositionValue(address user) view returns (int256)",
  "function positions(address user) view returns (string baseToken, string quoteToken, uint256 notional, bool isLong, uint256 entryShare)"
];

async function generateFastData() {
  console.log('⚡ Generating test data FAST...\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const deploymentData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../contracts/deployments/arbitrum.json'), 'utf8')
  );

  const oracle = new ethers.Contract(deploymentData.contracts.RatioOracle, ORACLE_ABI, provider);
  const perp = new ethers.Contract(deploymentData.contracts.SimplePerpV2, PERP_ABI, provider);

  const alice = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY, provider);
  const bob = new ethers.Wallet(process.env.BOB_PRIVATE_KEY, provider);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const events = [];
  let ethPrice = 3000;
  let btcPrice = 60000;

  try {
    // Batch 1: Set initial prices and open positions
    console.log('🔄 Batch 1: Opening positions...');
    
    // Update price
    ethPrice = 3100;
    btcPrice = 62000;
    await oracle.connect(deployer).setPrice('ETH', ethers.parseUnits(ethPrice.toString(), 18));
    await oracle.connect(deployer).setPrice('BTC', ethers.parseUnits(btcPrice.toString(), 18));
    
    // Alice opens long
    await perp.connect(alice).openPosition('ETH', 'BTC', ethers.parseUnits('200', 6), true);
    events.push({ type: 'OPEN', trader: 'Alice', position: 'LONG', amount: '200', price: `ETH=${ethPrice}, BTC=${btcPrice}` });
    
    // Bob opens short  
    await perp.connect(bob).openPosition('ETH', 'BTC', ethers.parseUnits('200', 6), false);
    events.push({ type: 'OPEN', trader: 'Bob', position: 'SHORT', amount: '200', price: `ETH=${ethPrice}, BTC=${btcPrice}` });
    
    console.log('✅ Positions opened\n');
    
    // Batch 2: Price movement and close
    console.log('🔄 Batch 2: Price pump and close...');
    
    // ETH pumps
    ethPrice = 3300;
    btcPrice = 61000;
    await oracle.connect(deployer).setPrice('ETH', ethers.parseUnits(ethPrice.toString(), 18));
    await oracle.connect(deployer).setPrice('BTC', ethers.parseUnits(btcPrice.toString(), 18));
    events.push({ type: 'PRICE', change: 'ETH_PUMP', price: `ETH=${ethPrice}, BTC=${btcPrice}` });
    
    // Check PnL
    const alicePnL1 = await perp.getPositionValue(alice.address);
    const bobPnL1 = await perp.getPositionValue(bob.address);
    
    // Close positions
    await perp.connect(alice).closePosition();
    events.push({ type: 'CLOSE', trader: 'Alice', pnl: ethers.formatUnits(alicePnL1, 6) });
    
    await perp.connect(bob).closePosition();
    events.push({ type: 'CLOSE', trader: 'Bob', pnl: ethers.formatUnits(bobPnL1, 6) });
    
    console.log('✅ Positions closed after ETH pump\n');
    
    // Batch 3: Reverse positions
    console.log('🔄 Batch 3: Reverse positions...');
    
    // Bob goes long, Alice goes short
    await perp.connect(bob).openPosition('ETH', 'BTC', ethers.parseUnits('300', 6), true);
    events.push({ type: 'OPEN', trader: 'Bob', position: 'LONG', amount: '300' });
    
    await perp.connect(alice).openPosition('ETH', 'BTC', ethers.parseUnits('300', 6), false);
    events.push({ type: 'OPEN', trader: 'Alice', position: 'SHORT', amount: '300' });
    
    console.log('✅ Reverse positions opened\n');
    
    // Batch 4: BTC pump
    console.log('🔄 Batch 4: BTC pump...');
    
    ethPrice = 3200;
    btcPrice = 65000;
    await oracle.connect(deployer).setPrice('ETH', ethers.parseUnits(ethPrice.toString(), 18));
    await oracle.connect(deployer).setPrice('BTC', ethers.parseUnits(btcPrice.toString(), 18));
    events.push({ type: 'PRICE', change: 'BTC_PUMP', price: `ETH=${ethPrice}, BTC=${btcPrice}` });
    
    // Final PnL
    const alicePnL2 = await perp.getPositionValue(alice.address);
    const bobPnL2 = await perp.getPositionValue(bob.address);
    
    await perp.connect(alice).closePosition();
    events.push({ type: 'CLOSE', trader: 'Alice', pnl: ethers.formatUnits(alicePnL2, 6) });
    
    await perp.connect(bob).closePosition();
    events.push({ type: 'CLOSE', trader: 'Bob', pnl: ethers.formatUnits(bobPnL2, 6) });
    
    console.log('✅ Final positions closed\n');
    
    // Get final balances
    const aliceFinal = await perp.balances(alice.address);
    const bobFinal = await perp.balances(bob.address);
    
    // Summary
    const summary = {
      generated: new Date().toISOString(),
      contracts: deploymentData.contracts,
      traders: {
        alice: { address: alice.address, finalBalance: ethers.formatUnits(aliceFinal, 6) },
        bob: { address: bob.address, finalBalance: ethers.formatUnits(bobFinal, 6) }
      },
      events,
      stats: {
        totalTrades: events.filter(e => e.type === 'OPEN').length,
        totalCloses: events.filter(e => e.type === 'CLOSE').length,
        priceUpdates: events.filter(e => e.type === 'PRICE').length
      }
    };
    
    fs.writeFileSync(
      path.join(__dirname, '../test-data-fast.json'),
      JSON.stringify(summary, null, 2)
    );
    
    console.log('📊 Summary:');
    console.log('============');
    console.log(`Total trades: ${summary.stats.totalTrades}`);
    console.log(`Alice final: ${summary.traders.alice.finalBalance} USDC`);
    console.log(`Bob final: ${summary.traders.bob.finalBalance} USDC`);
    console.log(`\n✅ Data saved to test-data-fast.json`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateFastData().catch(console.error);