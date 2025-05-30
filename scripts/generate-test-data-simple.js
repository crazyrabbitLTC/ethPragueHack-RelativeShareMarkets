const { ethers } = require('ethers');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Contract ABIs
const USDC_ABI = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
];

const ORACLE_ABI = [
  "function setPrice(string token, uint256 price)",
  "function getRatioShare(string baseToken, string quoteToken) view returns (uint256)"
];

const PERP_ABI = [
  "function deposit(uint256 amount)",
  "function openPosition(string baseToken, string quoteToken, uint256 notional, bool isLong)",
  "function closePosition()",
  "function balances(address user) view returns (uint256)",
  "function getPositionValue(address user) view returns (int256)",
  "function positions(address user) view returns (string baseToken, string quoteToken, uint256 notional, bool isLong, uint256 entryShare)"
];

async function generateTestData() {
  console.log('🚀 Starting quick test data generation...\n');
  
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const deploymentData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../contracts/deployments/arbitrum.json'), 'utf8')
  );

  const contracts = {
    usdc: new ethers.Contract(deploymentData.contracts.MockUSDC, USDC_ABI, provider),
    oracle: new ethers.Contract(deploymentData.contracts.RatioOracle, ORACLE_ABI, provider),
    perp: new ethers.Contract(deploymentData.contracts.SimplePerpV2, PERP_ABI, provider)
  };

  // Use existing wallets to save time
  const alice = new ethers.Wallet(process.env.ALICE_PRIVATE_KEY, provider);
  const bob = new ethers.Wallet(process.env.BOB_PRIVATE_KEY, provider);
  const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log('Using existing wallets:');
  console.log('Alice:', alice.address);
  console.log('Bob:', bob.address);
  console.log('');

  const events = [];
  let ethPrice = 3000;
  let btcPrice = 60000;

  try {
    // Get current nonce for deployer to handle any pending transactions
    let deployerNonce = await provider.getTransactionCount(deployer.address, 'pending');
    
    // Check existing balances
    const aliceBalance = await contracts.perp.balances(alice.address);
    const bobBalance = await contracts.perp.balances(bob.address);
    
    console.log('Current balances:');
    console.log('Alice:', ethers.formatUnits(aliceBalance, 6), 'USDC');
    console.log('Bob:', ethers.formatUnits(bobBalance, 6), 'USDC');
    console.log('');

    // Generate 20 trades quickly
    console.log('Generating trading activity...\n');
    
    for (let i = 0; i < 20; i++) {
      // Update prices
      ethPrice = ethPrice * (0.98 + Math.random() * 0.04);
      btcPrice = btcPrice * (0.98 + Math.random() * 0.04);
      
      // Set prices with explicit nonce management
      const ethTx = await contracts.oracle.connect(deployer).setPrice('ETH', ethers.parseUnits(ethPrice.toString(), 18), { nonce: deployerNonce++ });
      await ethTx.wait();
      const btcTx = await contracts.oracle.connect(deployer).setPrice('BTC', ethers.parseUnits(btcPrice.toString(), 18), { nonce: deployerNonce++ });
      await btcTx.wait();
      
      const ratio = await contracts.oracle.getRatioShare('ETH', 'BTC');
      const timestamp = new Date().toISOString();
      
      events.push({
        type: 'PRICE_UPDATE',
        timestamp,
        ethPrice: ethPrice.toFixed(2),
        btcPrice: btcPrice.toFixed(2),
        ratio: ethers.formatUnits(ratio, 16) + '%'
      });
      
      console.log(`📊 Price update ${i + 1}: ETH=$${ethPrice.toFixed(2)}, BTC=$${btcPrice.toFixed(2)}`);

      // Alternate between opening and closing positions
      if (i % 4 === 0) {
        // Alice opens long
        const notional = ethers.parseUnits((100 + Math.random() * 200).toFixed(0), 6);
        await contracts.perp.connect(alice).openPosition('ETH', 'BTC', notional, true);
        
        events.push({
          type: 'POSITION_OPEN',
          timestamp,
          trader: 'Alice',
          address: alice.address,
          position: 'LONG',
          notional: ethers.formatUnits(notional, 6),
          entryRatio: ethers.formatUnits(ratio, 16) + '%'
        });
        
        console.log(`✅ Alice opened LONG $${ethers.formatUnits(notional, 6)}`);
      } else if (i % 4 === 1) {
        // Bob opens short
        const notional = ethers.parseUnits((100 + Math.random() * 200).toFixed(0), 6);
        await contracts.perp.connect(bob).openPosition('ETH', 'BTC', notional, false);
        
        events.push({
          type: 'POSITION_OPEN',
          timestamp,
          trader: 'Bob',
          address: bob.address,
          position: 'SHORT',
          notional: ethers.formatUnits(notional, 6),
          entryRatio: ethers.formatUnits(ratio, 16) + '%'
        });
        
        console.log(`✅ Bob opened SHORT $${ethers.formatUnits(notional, 6)}`);
      } else if (i % 4 === 2) {
        // Alice closes if she has position
        try {
          const pnl = await contracts.perp.getPositionValue(alice.address);
          await contracts.perp.connect(alice).closePosition();
          
          events.push({
            type: 'POSITION_CLOSE',
            timestamp,
            trader: 'Alice',
            address: alice.address,
            pnl: ethers.formatUnits(pnl, 6),
            exitRatio: ethers.formatUnits(ratio, 16) + '%'
          });
          
          const pnlColor = pnl > 0 ? '🟢' : '🔴';
          console.log(`${pnlColor} Alice closed position, PnL: $${ethers.formatUnits(pnl, 6)}`);
        } catch (e) {
          // No position to close
        }
      } else {
        // Bob closes if he has position
        try {
          const pnl = await contracts.perp.getPositionValue(bob.address);
          await contracts.perp.connect(bob).closePosition();
          
          events.push({
            type: 'POSITION_CLOSE',
            timestamp,
            trader: 'Bob',
            address: bob.address,
            pnl: ethers.formatUnits(pnl, 6),
            exitRatio: ethers.formatUnits(ratio, 16) + '%'
          });
          
          const pnlColor = pnl > 0 ? '🟢' : '🔴';
          console.log(`${pnlColor} Bob closed position, PnL: $${ethers.formatUnits(pnl, 6)}`);
        } catch (e) {
          // No position to close
        }
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final balances
    const aliceFinal = await contracts.perp.balances(alice.address);
    const bobFinal = await contracts.perp.balances(bob.address);
    
    console.log('\n📈 Final Results:');
    console.log('==================');
    console.log(`Alice: ${ethers.formatUnits(aliceFinal, 6)} USDC (${aliceFinal > aliceBalance ? 'profit' : 'loss'})`);
    console.log(`Bob: ${ethers.formatUnits(bobFinal, 6)} USDC (${bobFinal > bobBalance ? 'profit' : 'loss'})`);
    console.log(`Total events generated: ${events.length}`);
    
    // Save data
    const exportData = {
      generated: new Date().toISOString(),
      contractAddresses: {
        usdc: deploymentData.contracts.MockUSDC,
        oracle: deploymentData.contracts.RatioOracle,
        perp: deploymentData.contracts.SimplePerpV2
      },
      events,
      summary: {
        totalEvents: events.length,
        priceUpdates: events.filter(e => e.type === 'PRICE_UPDATE').length,
        positionsOpened: events.filter(e => e.type === 'POSITION_OPEN').length,
        positionsClosed: events.filter(e => e.type === 'POSITION_CLOSE').length
      }
    };
    
    fs.writeFileSync(
      path.join(__dirname, '../test-data-simple.json'),
      JSON.stringify(exportData, null, 2)
    );
    
    console.log('\n✅ Data saved to test-data-simple.json');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

generateTestData().catch(console.error);