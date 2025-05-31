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

async function generateAliceBobData() {
  console.log('💫 Generating trading data with Alice and Bob...\n');
  
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
  const trades = [];
  let ethPrice = 3000;
  let btcPrice = 60000;
  let tradeId = 1;

  // Get starting nonce
  let nonce = await provider.getTransactionCount(deployer.address, 'pending');
  
  console.log('Starting balances:');
  const aliceStart = await perp.balances(alice.address);
  const bobStart = await perp.balances(bob.address);
  console.log(`Alice: ${ethers.formatUnits(aliceStart, 6)} USDC`);
  console.log(`Bob: ${ethers.formatUnits(bobStart, 6)} USDC`);
  
  // Check if they have open positions and close them first
  const alicePos = await perp.positions(alice.address);
  const bobPos = await perp.positions(bob.address);
  
  if (alicePos.notional > 0) {
    console.log('Closing Alice\'s existing position...');
    await perp.connect(alice).closePosition();
  }
  
  if (bobPos.notional > 0) {
    console.log('Closing Bob\'s existing position...');
    await perp.connect(bob).closePosition();
  }
  
  console.log('');

  try {
    // Generate 50 trades
    for (let round = 0; round < 50; round++) {
      console.log(`\n--- Round ${round + 1}/50 ---`);
      
      // Update prices with trend
      const trend = Math.sin(round / 8) * 0.1; // Sinusoidal trend
      const randomness = (Math.random() - 0.5) * 0.02;
      ethPrice = ethPrice * (1 + trend + randomness);
      btcPrice = btcPrice * (1 + trend * 0.5 + randomness * 0.5);
      
      // Set prices with explicit nonce
      await oracle.connect(deployer).setPrice('ETH', ethers.parseUnits(ethPrice.toString(), 18), { nonce: nonce++ });
      await oracle.connect(deployer).setPrice('BTC', ethers.parseUnits(btcPrice.toString(), 18), { nonce: nonce++ });
      
      const ratio = await oracle.getRatioShare('ETH', 'BTC');
      const timestamp = new Date().toISOString();
      
      events.push({
        type: 'PRICE_UPDATE',
        timestamp,
        round: round + 1,
        ethPrice: ethPrice.toFixed(2),
        btcPrice: btcPrice.toFixed(2),
        ratio: ethers.formatUnits(ratio, 16) + '%'
      });
      
      console.log(`ETH: $${ethPrice.toFixed(2)}, BTC: $${btcPrice.toFixed(2)}, Ratio: ${ethers.formatUnits(ratio, 16)}%`);
      
      // Trading logic
      if (round % 4 === 0) {
        // Open new positions
        const aliceNotional = ethers.parseUnits((100 + Math.random() * 300).toFixed(0), 6);
        const bobNotional = ethers.parseUnits((100 + Math.random() * 300).toFixed(0), 6);
        
        await perp.connect(alice).openPosition('ETH', 'BTC', aliceNotional, true);
        await perp.connect(bob).openPosition('ETH', 'BTC', bobNotional, false);
        
        trades.push({
          id: tradeId++,
          type: 'OPEN',
          timestamp,
          round: round + 1,
          alice: { position: 'LONG', notional: ethers.formatUnits(aliceNotional, 6) },
          bob: { position: 'SHORT', notional: ethers.formatUnits(bobNotional, 6) },
          entryRatio: ethers.formatUnits(ratio, 16) + '%'
        });
        
        console.log(`✅ Alice LONG $${ethers.formatUnits(aliceNotional, 6)}, Bob SHORT $${ethers.formatUnits(bobNotional, 6)}`);
        
      } else if (round % 4 === 2) {
        // Close positions if they exist
        try {
          const alicePos = await perp.positions(alice.address);
          const bobPos = await perp.positions(bob.address);
          
          if (alicePos.notional > 0 && bobPos.notional > 0) {
            const alicePnl = await perp.getPositionValue(alice.address);
            const bobPnl = await perp.getPositionValue(bob.address);
            
            await perp.connect(alice).closePosition();
            await perp.connect(bob).closePosition();
            
            trades.push({
              id: tradeId++,
              type: 'CLOSE',
              timestamp,
              round: round + 1,
              alice: { pnl: ethers.formatUnits(alicePnl, 6) },
              bob: { pnl: ethers.formatUnits(bobPnl, 6) },
              exitRatio: ethers.formatUnits(ratio, 16) + '%'
            });
            
            console.log(`💰 Alice PnL: $${ethers.formatUnits(alicePnl, 6)}, Bob PnL: $${ethers.formatUnits(bobPnl, 6)}`);
          }
        } catch (e) {
          // No positions to close
        }
      }
      
      // Small delay every 10 rounds
      if (round % 10 === 9) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Final statistics
    const aliceFinal = await perp.balances(alice.address);
    const bobFinal = await perp.balances(bob.address);
    
    const stats = {
      generated: new Date().toISOString(),
      network: 'arbitrum',
      contracts: deploymentData.contracts,
      summary: {
        rounds: 50,
        totalEvents: events.length,
        totalTrades: trades.length,
        priceUpdates: events.filter(e => e.type === 'PRICE_UPDATE').length
      },
      traders: {
        alice: {
          address: alice.address,
          startBalance: ethers.formatUnits(aliceStart, 6),
          finalBalance: ethers.formatUnits(aliceFinal, 6),
          pnl: ethers.formatUnits(aliceFinal - aliceStart, 6)
        },
        bob: {
          address: bob.address,
          startBalance: ethers.formatUnits(bobStart, 6),
          finalBalance: ethers.formatUnits(bobFinal, 6),
          pnl: ethers.formatUnits(bobFinal - bobStart, 6)
        }
      },
      priceRange: {
        eth: { start: 3000, end: ethPrice.toFixed(2) },
        btc: { start: 60000, end: btcPrice.toFixed(2) }
      },
      events: events.slice(-20), // Last 20 events
      trades: trades.slice(-10) // Last 10 trades
    };
    
    // Save full data
    fs.writeFileSync(
      path.join(__dirname, '../alice-bob-trades.json'),
      JSON.stringify({ stats, allEvents: events, allTrades: trades }, null, 2)
    );
    
    console.log('\n📊 SUMMARY:');
    console.log('===========');
    console.log(`Total rounds: ${stats.summary.rounds}`);
    console.log(`Total trades: ${stats.summary.totalTrades}`);
    console.log(`Price updates: ${stats.summary.priceUpdates}`);
    console.log(`\nAlice: ${stats.traders.alice.startBalance} → ${stats.traders.alice.finalBalance} USDC (${stats.traders.alice.pnl})`);
    console.log(`Bob: ${stats.traders.bob.startBalance} → ${stats.traders.bob.finalBalance} USDC (${stats.traders.bob.pnl})`);
    console.log(`\n✅ Data saved to alice-bob-trades.json`);
    
  } catch (error) {
    console.error('Error:', error.message);
    
    // Save whatever data we got
    fs.writeFileSync(
      path.join(__dirname, '../alice-bob-trades-partial.json'),
      JSON.stringify({ events, trades }, null, 2)
    );
    console.log('\n⚠️  Partial data saved to alice-bob-trades-partial.json');
  }
}

generateAliceBobData().catch(console.error);