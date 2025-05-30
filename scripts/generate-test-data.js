const { ethers } = require('ethers');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Colors for output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

// Contract ABIs
const USDC_ABI = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
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

// Trader profiles for diverse behavior - reduced position sizes for more trades
const TRADER_PROFILES = [
  { name: 'Scalper', holdTime: 30, positionSize: 50, winRate: 0.55 },
  { name: 'DayTrader', holdTime: 60, positionSize: 100, winRate: 0.50 },
  { name: 'SwingTrader', holdTime: 120, positionSize: 200, winRate: 0.45 },
  { name: 'HODLer', holdTime: 180, positionSize: 300, winRate: 0.40 },
  { name: 'Degen', holdTime: 45, positionSize: 150, winRate: 0.35 }
];

// Price scenarios
const PRICE_SCENARIOS = [
  { name: 'Rally', ethChange: 1.15, btcChange: 1.05, duration: 300 },
  { name: 'Crash', ethChange: 0.85, btcChange: 0.90, duration: 180 },
  { name: 'ETH Pump', ethChange: 1.20, btcChange: 0.98, duration: 240 },
  { name: 'BTC Pump', ethChange: 1.02, btcChange: 1.18, duration: 240 },
  { name: 'Sideways', ethChange: 1.01, btcChange: 0.99, duration: 600 },
  { name: 'Volatile', ethChange: 1.10, btcChange: 0.95, duration: 120 }
];

class TestDataGenerator {
  constructor(provider, contracts) {
    this.provider = provider;
    this.contracts = contracts;
    this.traders = [];
    this.priceHistory = [];
    this.tradeHistory = [];
    this.currentPrices = {
      ETH: ethers.parseUnits('3000', 18),
      BTC: ethers.parseUnits('60000', 18)
    };
  }

  async initialize() {
    console.log(`${colors.cyan}📊 Initializing Test Data Generator${colors.reset}`);
    console.log(`${colors.cyan}====================================${colors.reset}\n`);

    // Create trader wallets
    for (let i = 0; i < TRADER_PROFILES.length; i++) {
      const wallet = ethers.Wallet.createRandom().connect(this.provider);
      const profile = TRADER_PROFILES[i];
      
      this.traders.push({
        wallet,
        profile,
        address: wallet.address,
        positions: [],
        pnlHistory: [],
        totalVolume: 0
      });
      
      console.log(`${colors.green}✓ Created trader: ${profile.name} (${wallet.address})${colors.reset}`);
    }

    // Fund traders with ETH for gas
    console.log(`\n${colors.yellow}Funding traders with ETH...${colors.reset}`);
    // Use deployer wallet which should have more funds
    const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    
    // Check deployer balance first
    const deployerBalance = await this.provider.getBalance(deployer.address);
    console.log(`Deployer balance: ${ethers.formatEther(deployerBalance)} ETH`);
    
    for (const trader of this.traders) {
      try {
        // Get current gas price and add 20% buffer
        const feeData = await this.provider.getFeeData();
        const maxFeePerGas = feeData.maxFeePerGas * BigInt(120) / BigInt(100);
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas * BigInt(120) / BigInt(100);
        
        const tx = await deployer.sendTransaction({
          to: trader.address,
          value: ethers.parseEther('0.0005'), // 0.0005 ETH for gas (minimal amount)
          maxFeePerGas,
          maxPriorityFeePerGas
        });
        await tx.wait();
        console.log(`${colors.green}✓ Funded ${trader.profile.name} with 0.0005 ETH${colors.reset}`);
      } catch (error) {
        console.log(`${colors.red}✗ Failed to fund ${trader.profile.name}: ${error.message}${colors.reset}`);
      }
    }

    // Mint USDC to traders
    console.log(`\n${colors.yellow}Minting USDC to traders...${colors.reset}`);
    
    for (const trader of this.traders) {
      const mintAmount = ethers.parseUnits((trader.profile.positionSize * 10).toString(), 6);
      const mintTx = await this.contracts.usdc.connect(deployer).mint(trader.address, mintAmount);
      await mintTx.wait();
      
      // Approve perpetual contract
      const approveTx = await this.contracts.usdc.connect(trader.wallet).approve(
        this.contracts.perp.target,
        ethers.MaxUint256
      );
      await approveTx.wait();
      
      console.log(`${colors.green}✓ Minted ${ethers.formatUnits(mintAmount, 6)} USDC to ${trader.profile.name}${colors.reset}`);
    }

    // Initial deposits
    console.log(`\n${colors.yellow}Making initial deposits...${colors.reset}`);
    for (const trader of this.traders) {
      const depositAmount = ethers.parseUnits((trader.profile.positionSize * 5).toString(), 6);
      const depositTx = await this.contracts.perp.connect(trader.wallet).deposit(depositAmount);
      await depositTx.wait();
      
      console.log(`${colors.green}✓ ${trader.profile.name} deposited ${ethers.formatUnits(depositAmount, 6)} USDC${colors.reset}`);
    }

    console.log(`\n${colors.green}✅ Initialization complete!${colors.reset}\n`);
  }

  async generateActivity(durationMinutes = 30) {
    console.log(`${colors.blue}🎯 Generating ${durationMinutes} minutes of trading activity${colors.reset}`);
    console.log(`${colors.blue}=================================================${colors.reset}\n`);

    const startTime = Date.now();
    const endTime = startTime + (durationMinutes * 60 * 1000);
    let actionCount = 0;

    // Initial price update
    await this.updatePrices();

    while (Date.now() < endTime) {
      // Random delay between actions (2-10 seconds) - faster for more data
      const delay = 2000 + Math.random() * 8000;
      await this.sleep(delay);

      // Choose random action
      const actionType = Math.random();
      
      if (actionType < 0.3) {
        // Update prices (30% chance)
        await this.updatePrices();
      } else if (actionType < 0.7) {
        // Open position (40% chance)
        await this.openRandomPosition();
      } else {
        // Close position (30% chance)
        await this.closeRandomPosition();
      }

      actionCount++;
      
      // Progress update every 10 actions
      if (actionCount % 10 === 0) {
        const elapsed = Math.floor((Date.now() - startTime) / 60000);
        console.log(`\n${colors.cyan}⏱️  Progress: ${elapsed}/${durationMinutes} minutes, ${actionCount} actions${colors.reset}\n`);
      }
    }

    console.log(`\n${colors.green}✅ Generated ${actionCount} actions over ${durationMinutes} minutes${colors.reset}\n`);
    await this.printSummary();
  }

  async updatePrices() {
    // Apply random price movement
    const ethChange = 0.98 + Math.random() * 0.04; // +/- 2%
    const btcChange = 0.98 + Math.random() * 0.04; // +/- 2%

    this.currentPrices.ETH = BigInt(Math.floor(Number(this.currentPrices.ETH) * ethChange));
    this.currentPrices.BTC = BigInt(Math.floor(Number(this.currentPrices.BTC) * btcChange));

    // Update oracle
    const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    
    const ethTx = await this.contracts.oracle.connect(deployer).setPrice('ETH', this.currentPrices.ETH);
    await ethTx.wait();
    
    const btcTx = await this.contracts.oracle.connect(deployer).setPrice('BTC', this.currentPrices.BTC);
    await btcTx.wait();

    const ratio = await this.contracts.oracle.getRatioShare('ETH', 'BTC');
    
    this.priceHistory.push({
      timestamp: Date.now(),
      ethPrice: Number(ethers.formatUnits(this.currentPrices.ETH, 18)),
      btcPrice: Number(ethers.formatUnits(this.currentPrices.BTC, 18)),
      ratio: Number(ethers.formatUnits(ratio, 16))
    });

    console.log(`${colors.magenta}📈 Price Update: ETH=$${ethers.formatUnits(this.currentPrices.ETH, 18).slice(0, 7)}, BTC=$${ethers.formatUnits(this.currentPrices.BTC, 18).slice(0, 8)}, Ratio=${ethers.formatUnits(ratio, 16)}%${colors.reset}`);
  }

  async openRandomPosition() {
    // Select random trader without position
    const availableTraders = this.traders.filter(t => t.positions.length === 0);
    if (availableTraders.length === 0) return;

    const trader = availableTraders[Math.floor(Math.random() * availableTraders.length)];
    const isLong = Math.random() < 0.5;
    const notional = ethers.parseUnits(trader.profile.positionSize.toString(), 6);

    try {
      const balance = await this.contracts.perp.balances(trader.address);
      const requiredMargin = notional * BigInt(30) / BigInt(100); // 30% margin

      if (balance < requiredMargin) {
        console.log(`${colors.yellow}⚠️  ${trader.profile.name} insufficient margin${colors.reset}`);
        return;
      }

      const tx = await this.contracts.perp.connect(trader.wallet).openPosition('ETH', 'BTC', notional, isLong);
      await tx.wait();

      const position = {
        trader: trader.profile.name,
        address: trader.address,
        type: isLong ? 'LONG' : 'SHORT',
        notional: Number(ethers.formatUnits(notional, 6)),
        openTime: Date.now(),
        entryRatio: this.priceHistory[this.priceHistory.length - 1].ratio
      };

      trader.positions.push(position);
      trader.totalVolume += position.notional;
      this.tradeHistory.push({ ...position, action: 'OPEN' });

      console.log(`${colors.green}✓ ${trader.profile.name} opened ${isLong ? 'LONG' : 'SHORT'} $${position.notional}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}✗ Failed to open position for ${trader.profile.name}: ${error.message}${colors.reset}`);
    }
  }

  async closeRandomPosition() {
    // Select random trader with position
    const tradersWithPositions = this.traders.filter(t => t.positions.length > 0);
    if (tradersWithPositions.length === 0) return;

    const trader = tradersWithPositions[Math.floor(Math.random() * tradersWithPositions.length)];
    const position = trader.positions[0];

    // Check if minimum hold time has passed
    const holdTime = (Date.now() - position.openTime) / 1000;
    if (holdTime < trader.profile.holdTime * 0.3) return; // At least 30% of typical hold time - allow faster closes

    try {
      const pnlBefore = await this.contracts.perp.getPositionValue(trader.address);
      const tx = await this.contracts.perp.connect(trader.wallet).closePosition();
      await tx.wait();

      const currentRatio = this.priceHistory[this.priceHistory.length - 1].ratio;
      const ratioChange = currentRatio - position.entryRatio;
      const pnl = position.type === 'LONG' ? ratioChange : -ratioChange;
      const pnlUsd = (position.notional * pnl) / 100;

      trader.positions = [];
      trader.pnlHistory.push(pnlUsd);

      this.tradeHistory.push({
        ...position,
        action: 'CLOSE',
        closeTime: Date.now(),
        exitRatio: currentRatio,
        pnl: pnlUsd,
        holdTime: Math.floor(holdTime)
      });

      const pnlColor = pnlUsd >= 0 ? colors.green : colors.red;
      console.log(`${colors.blue}✓ ${trader.profile.name} closed ${position.type} (held ${Math.floor(holdTime)}s) PnL: ${pnlColor}$${pnlUsd.toFixed(2)}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}✗ Failed to close position for ${trader.profile.name}: ${error.message}${colors.reset}`);
    }
  }

  async printSummary() {
    console.log(`\n${colors.cyan}📊 TRADING SUMMARY${colors.reset}`);
    console.log(`${colors.cyan}==================${colors.reset}\n`);

    // Overall stats
    const totalTrades = this.tradeHistory.filter(t => t.action === 'OPEN').length;
    const closedTrades = this.tradeHistory.filter(t => t.action === 'CLOSE').length;
    const totalVolume = this.traders.reduce((sum, t) => sum + t.totalVolume, 0);

    console.log(`${colors.yellow}Overall Statistics:${colors.reset}`);
    console.log(`Total Positions Opened: ${totalTrades}`);
    console.log(`Total Positions Closed: ${closedTrades}`);
    console.log(`Total Volume: $${totalVolume.toFixed(2)}`);
    console.log(`Price Updates: ${this.priceHistory.length}`);

    // Trader performance
    console.log(`\n${colors.yellow}Trader Performance:${colors.reset}`);
    for (const trader of this.traders) {
      const totalPnl = trader.pnlHistory.reduce((sum, pnl) => sum + pnl, 0);
      const winCount = trader.pnlHistory.filter(pnl => pnl > 0).length;
      const winRate = trader.pnlHistory.length > 0 ? (winCount / trader.pnlHistory.length * 100) : 0;
      
      const pnlColor = totalPnl >= 0 ? colors.green : colors.red;
      console.log(`${trader.profile.name}: ${trader.pnlHistory.length} trades, ${winRate.toFixed(0)}% win rate, PnL: ${pnlColor}$${totalPnl.toFixed(2)}${colors.reset}`);
    }

    // Price movement
    if (this.priceHistory.length > 1) {
      const firstPrice = this.priceHistory[0];
      const lastPrice = this.priceHistory[this.priceHistory.length - 1];
      const ethChange = ((lastPrice.ethPrice - firstPrice.ethPrice) / firstPrice.ethPrice * 100);
      const btcChange = ((lastPrice.btcPrice - firstPrice.btcPrice) / firstPrice.btcPrice * 100);
      const ratioChange = lastPrice.ratio - firstPrice.ratio;

      console.log(`\n${colors.yellow}Price Movement:${colors.reset}`);
      console.log(`ETH: $${firstPrice.ethPrice.toFixed(2)} → $${lastPrice.ethPrice.toFixed(2)} (${ethChange >= 0 ? '+' : ''}${ethChange.toFixed(2)}%)`);
      console.log(`BTC: $${firstPrice.btcPrice.toFixed(2)} → $${lastPrice.btcPrice.toFixed(2)} (${btcChange >= 0 ? '+' : ''}${btcChange.toFixed(2)}%)`);
      console.log(`ETH/BTC Ratio: ${firstPrice.ratio.toFixed(2)}% → ${lastPrice.ratio.toFixed(2)}% (${ratioChange >= 0 ? '+' : ''}${ratioChange.toFixed(2)}%)`);
    }

    // Save data for indexer
    const dataExport = {
      generated: new Date().toISOString(),
      summary: {
        totalTrades,
        closedTrades,
        totalVolume,
        priceUpdates: this.priceHistory.length
      },
      traders: this.traders.map(t => ({
        profile: t.profile.name,
        address: t.address,
        totalVolume: t.totalVolume,
        pnlHistory: t.pnlHistory,
        finalPnl: t.pnlHistory.reduce((sum, pnl) => sum + pnl, 0)
      })),
      priceHistory: this.priceHistory,
      tradeHistory: this.tradeHistory
    };

    fs.writeFileSync(
      path.join(__dirname, '../test-data-export.json'),
      JSON.stringify(dataExport, null, 2)
    );

    console.log(`\n${colors.green}✅ Data exported to test-data-export.json${colors.reset}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  try {
    // Setup
    const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
    const deploymentData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../contracts/deployments/arbitrum.json'), 'utf8')
    );

    const contracts = {
      usdc: new ethers.Contract(deploymentData.contracts.MockUSDC, USDC_ABI, provider),
      oracle: new ethers.Contract(deploymentData.contracts.RatioOracle, ORACLE_ABI, provider),
      perp: new ethers.Contract(deploymentData.contracts.SimplePerpV2, PERP_ABI, provider)
    };

    // Get duration from command line or default to 10 minutes
    const duration = process.argv[2] ? parseInt(process.argv[2]) : 10;

    const generator = new TestDataGenerator(provider, contracts);
    await generator.initialize();
    await generator.generateActivity(duration);

  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the generator
main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
  process.exit(1);
});