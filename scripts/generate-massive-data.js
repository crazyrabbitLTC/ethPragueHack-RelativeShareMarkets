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

const USDC_ABI = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
];

// Market scenarios for realistic patterns
const MARKET_SCENARIOS = [
  { name: 'bull_run', ethMultiplier: 1.15, btcMultiplier: 1.08, volatility: 0.02 },
  { name: 'bear_market', ethMultiplier: 0.85, btcMultiplier: 0.90, volatility: 0.03 },
  { name: 'eth_season', ethMultiplier: 1.25, btcMultiplier: 0.95, volatility: 0.04 },
  { name: 'btc_dominance', ethMultiplier: 0.92, btcMultiplier: 1.20, volatility: 0.02 },
  { name: 'choppy', ethMultiplier: 1.0, btcMultiplier: 1.0, volatility: 0.05 },
  { name: 'flash_crash', ethMultiplier: 0.70, btcMultiplier: 0.75, volatility: 0.10 }
];

async function generateMassiveData() {
  console.log('🚀 MASSIVE DATA GENERATION STARTING...\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const deploymentData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../contracts/deployments/arbitrum.json'), 'utf8')
  );

  const oracle = new ethers.Contract(deploymentData.contracts.RatioOracle, ORACLE_ABI, provider);
  const perp = new ethers.Contract(deploymentData.contracts.SimplePerpV2, PERP_ABI, provider);
  const usdc = new ethers.Contract(deploymentData.contracts.MockUSDC, USDC_ABI, provider);

  // Create multiple trading wallets
  const traders = [];
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log('Creating trader wallets...');
  for (let i = 0; i < 10; i++) {
    const wallet = ethers.Wallet.createRandom().connect(provider);
    traders.push({
      wallet,
      name: `Trader${i}`,
      style: i % 3 === 0 ? 'aggressive' : i % 3 === 1 ? 'conservative' : 'balanced',
      hasPosition: false
    });
  }

  // Use existing funded wallets too
  traders.push({
    wallet: new ethers.Wallet(process.env.ALICE_PRIVATE_KEY, provider),
    name: 'Alice',
    style: 'balanced',
    hasPosition: false
  });
  
  traders.push({
    wallet: new ethers.Wallet(process.env.BOB_PRIVATE_KEY, provider),
    name: 'Bob',
    style: 'aggressive',
    hasPosition: false
  });

  console.log(`✅ Created ${traders.length} traders\n`);

  // Fund new traders efficiently
  console.log('Funding new traders...');
  const newTraders = traders.slice(0, 10);
  
  // Fund with minimal ETH for gas
  for (const trader of newTraders) {
    try {
      const tx = await deployer.sendTransaction({
        to: trader.wallet.address,
        value: ethers.parseEther('0.0002')
      });
      await tx.wait();
    } catch (e) {
      console.log(`Warning: Could not fund ${trader.name}`);
    }
  }

  // Mint USDC to new traders
  for (const trader of newTraders) {
    try {
      const mintTx = await usdc.connect(deployer).mint(
        trader.wallet.address, 
        ethers.parseUnits('2000', 6)
      );
      await mintTx.wait();
      
      // Approve
      const approveTx = await usdc.connect(trader.wallet).approve(
        perp.target,
        ethers.MaxUint256
      );
      await approveTx.wait();
      
      // Deposit
      const depositTx = await perp.connect(trader.wallet).deposit(
        ethers.parseUnits('1000', 6)
      );
      await depositTx.wait();
      
      console.log(`✅ Funded ${trader.name}`);
    } catch (e) {
      console.log(`Warning: ${trader.name} setup incomplete`);
    }
  }

  // Data collection
  const events = [];
  const priceHistory = [];
  let ethPrice = 3000;
  let btcPrice = 60000;
  let tradeCount = 0;

  console.log('\n📊 GENERATING TRADING ACTIVITY...\n');

  // Generate data for multiple market scenarios
  for (const scenario of MARKET_SCENARIOS) {
    console.log(`\n🎬 Scenario: ${scenario.name.toUpperCase()}`);
    console.log('='.repeat(40));
    
    const scenarioStartPrice = { eth: ethPrice, btc: btcPrice };
    const targetEthPrice = ethPrice * scenario.ethMultiplier;
    const targetBtcPrice = btcPrice * scenario.btcMultiplier;
    const steps = 20; // 20 price updates per scenario
    
    for (let step = 0; step < steps; step++) {
      // Gradually move prices toward target with volatility
      const progress = step / steps;
      const noise = (Math.random() - 0.5) * scenario.volatility;
      
      ethPrice = scenarioStartPrice.eth + (targetEthPrice - scenarioStartPrice.eth) * progress * (1 + noise);
      btcPrice = scenarioStartPrice.btc + (targetBtcPrice - scenarioStartPrice.btc) * progress * (1 + noise);
      
      // Update prices
      try {
        await oracle.connect(deployer).setPrice('ETH', ethers.parseUnits(ethPrice.toString(), 18));
        await oracle.connect(deployer).setPrice('BTC', ethers.parseUnits(btcPrice.toString(), 18));
        
        const ratio = await oracle.getRatioShare('ETH', 'BTC');
        const timestamp = Date.now();
        
        priceHistory.push({
          timestamp,
          ethPrice: ethPrice.toFixed(2),
          btcPrice: btcPrice.toFixed(2),
          ratio: ethers.formatUnits(ratio, 16)
        });
        
        events.push({
          type: 'PRICE_UPDATE',
          timestamp,
          scenario: scenario.name,
          prices: { eth: ethPrice.toFixed(2), btc: btcPrice.toFixed(2) },
          ratio: ethers.formatUnits(ratio, 16) + '%'
        });
        
        // Trading decisions based on market conditions
        for (const trader of traders) {
          const shouldTrade = Math.random() < 0.3; // 30% chance to trade
          
          if (shouldTrade && !trader.hasPosition) {
            // Open position
            const isLong = scenario.name.includes('eth') ? true : 
                          scenario.name.includes('btc') ? false : 
                          Math.random() < 0.5;
            
            const notionalBase = trader.style === 'aggressive' ? 400 : 
                               trader.style === 'conservative' ? 100 : 200;
            const notional = ethers.parseUnits(
              (notionalBase + Math.random() * 100).toFixed(0), 
              6
            );
            
            try {
              const tx = await perp.connect(trader.wallet).openPosition(
                'ETH', 'BTC', notional, isLong
              );
              await tx.wait();
              
              trader.hasPosition = true;
              trader.positionType = isLong ? 'LONG' : 'SHORT';
              trader.entryRatio = ethers.formatUnits(ratio, 16);
              trader.notional = ethers.formatUnits(notional, 6);
              
              events.push({
                type: 'POSITION_OPEN',
                timestamp: Date.now(),
                trader: trader.name,
                position: trader.positionType,
                notional: trader.notional,
                entryRatio: trader.entryRatio + '%',
                scenario: scenario.name
              });
              
              tradeCount++;
              console.log(`✅ ${trader.name} opened ${trader.positionType} $${trader.notional}`);
            } catch (e) {
              // Skip if insufficient balance
            }
          } else if (shouldTrade && trader.hasPosition) {
            // Close position
            try {
              const pnl = await perp.getPositionValue(trader.wallet.address);
              const tx = await perp.connect(trader.wallet).closePosition();
              await tx.wait();
              
              const pnlValue = ethers.formatUnits(pnl, 6);
              
              events.push({
                type: 'POSITION_CLOSE',
                timestamp: Date.now(),
                trader: trader.name,
                closedPosition: trader.positionType,
                notional: trader.notional,
                entryRatio: trader.entryRatio + '%',
                exitRatio: ethers.formatUnits(ratio, 16) + '%',
                pnl: pnlValue,
                scenario: scenario.name
              });
              
              trader.hasPosition = false;
              tradeCount++;
              
              const pnlSymbol = pnl > 0 ? '🟢' : '🔴';
              console.log(`${pnlSymbol} ${trader.name} closed ${trader.positionType}, PnL: $${pnlValue}`);
            } catch (e) {
              // Skip if no position
            }
          }
        }
        
        // Small delay to prevent rate limiting
        if (step % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (e) {
        console.log('Price update error:', e.message);
      }
    }
    
    console.log(`\nScenario complete. Trades: ${tradeCount}`);
  }

  // Close any remaining positions
  console.log('\n🏁 Closing all remaining positions...');
  for (const trader of traders) {
    if (trader.hasPosition) {
      try {
        const pnl = await perp.getPositionValue(trader.wallet.address);
        await perp.connect(trader.wallet).closePosition();
        console.log(`Closed ${trader.name}'s position, PnL: $${ethers.formatUnits(pnl, 6)}`);
        tradeCount++;
      } catch (e) {
        // Skip
      }
    }
  }

  // Generate summary
  const summary = {
    generated: new Date().toISOString(),
    network: 'arbitrum',
    contracts: deploymentData.contracts,
    statistics: {
      totalEvents: events.length,
      totalTrades: tradeCount,
      priceUpdates: priceHistory.length,
      scenarios: MARKET_SCENARIOS.length,
      traders: traders.length,
      positionsOpened: events.filter(e => e.type === 'POSITION_OPEN').length,
      positionsClosed: events.filter(e => e.type === 'POSITION_CLOSE').length
    },
    marketScenarios: MARKET_SCENARIOS.map(s => s.name),
    priceRange: {
      eth: {
        min: Math.min(...priceHistory.map(p => parseFloat(p.ethPrice))),
        max: Math.max(...priceHistory.map(p => parseFloat(p.ethPrice)))
      },
      btc: {
        min: Math.min(...priceHistory.map(p => parseFloat(p.btcPrice))),
        max: Math.max(...priceHistory.map(p => parseFloat(p.btcPrice)))
      }
    },
    events: events.slice(-100), // Last 100 events
    priceHistory: priceHistory.slice(-50) // Last 50 price points
  };

  // Save full data
  fs.writeFileSync(
    path.join(__dirname, '../massive-test-data.json'),
    JSON.stringify({ ...summary, allEvents: events }, null, 2)
  );

  // Save summary for quick access
  fs.writeFileSync(
    path.join(__dirname, '../massive-test-summary.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log('\n📊 FINAL STATISTICS:');
  console.log('===================');
  console.log(`Total Events: ${events.length}`);
  console.log(`Total Trades: ${tradeCount}`);
  console.log(`Positions Opened: ${summary.statistics.positionsOpened}`);
  console.log(`Positions Closed: ${summary.statistics.positionsClosed}`);
  console.log(`Price Updates: ${priceHistory.length}`);
  console.log(`\nETH Price Range: $${summary.priceRange.eth.min.toFixed(2)} - $${summary.priceRange.eth.max.toFixed(2)}`);
  console.log(`BTC Price Range: $${summary.priceRange.btc.min.toFixed(2)} - $${summary.priceRange.btc.max.toFixed(2)}`);
  
  console.log('\n✅ Data saved to:');
  console.log('   - massive-test-data.json (full data)');
  console.log('   - massive-test-summary.json (summary)');
}

generateMassiveData().catch(console.error);