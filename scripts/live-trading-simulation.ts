import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { updatePythPrices, testPricesAndRatios } from "./pyth-live-demo";

dotenv.config();

const SIMPLEPERP_V2_ADDRESS = "0x99d45f0d21D135D0947F641Ae4C10E00DF820244";
const RATIO_ORACLE_ADDRESS = "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f";
const MOCK_USDC_ADDRESS = "0xe2696990894452AbE9ce45ba557979c2cbc6B3dd";

const SIMPLEPERP_V2_ABI = [
  "function deposit(uint256 amount) external",
  "function openPosition(string memory baseToken, string memory quoteToken, uint256 notional, bool isLong) external",
  "function closePosition(uint256 positionId) external",
  "function getPosition(address trader) external view returns (tuple(string baseToken, string quoteToken, uint256 notional, uint256 margin, bool isLong, uint256 entryShare, uint256 timestamp))",
  "function balances(address) external view returns (uint256)"
];

const MOCK_USDC_ABI = [
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)"
];

const RATIO_ORACLE_ABI = [
  "function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256)"
];

interface TradeScenario {
  description: string;
  baseToken: string;
  quoteToken: string;
  notional: string;
  isLong: boolean;
  delay: number; // seconds to wait before next trade
}

const DEMO_SCENARIOS: TradeScenario[] = [
  {
    description: "🔥 Opening long ETH position (betting ETH share will increase)",
    baseToken: "ETH",
    quoteToken: "BTC", 
    notional: "1000",
    isLong: true,
    delay: 10
  },
  {
    description: "📈 Opening another long ETH position",
    baseToken: "ETH",
    quoteToken: "BTC",
    notional: "2000", 
    isLong: true,
    delay: 15
  },
  {
    description: "📉 Opening short ETH position (betting BTC share will increase)",
    baseToken: "ETH",
    quoteToken: "BTC",
    notional: "1500",
    isLong: false,
    delay: 10
  },
  {
    description: "🚀 Final large long ETH position",
    baseToken: "ETH", 
    quoteToken: "BTC",
    notional: "5000",
    isLong: true,
    delay: 5
  }
];

async function setupDemoFunds(wallet: ethers.Wallet): Promise<void> {
  console.log("💰 Setting up demo funds...");
  
  const mockUSDC = new ethers.Contract(MOCK_USDC_ADDRESS, MOCK_USDC_ABI, wallet);
  const simplePerpV2 = new ethers.Contract(SIMPLEPERP_V2_ADDRESS, SIMPLEPERP_V2_ABI, wallet);
  
  try {
    // Mint USDC for trading
    const mintAmount = ethers.parseEther("50000"); // 50k USDC
    console.log("🏦 Minting", ethers.formatEther(mintAmount), "USDC...");
    
    const mintTx = await mockUSDC.mint(wallet.address, mintAmount);
    await mintTx.wait();
    console.log("✅ USDC minted");
    
    // Approve SimplePerpV2 to spend USDC
    console.log("🔓 Approving SimplePerpV2 to spend USDC...");
    const approveTx = await mockUSDC.approve(SIMPLEPERP_V2_ADDRESS, mintAmount);
    await approveTx.wait();
    console.log("✅ Approval granted");
    
    // Deposit USDC to SimplePerpV2
    const depositAmount = ethers.parseEther("25000"); // 25k USDC
    console.log("🏪 Depositing", ethers.formatEther(depositAmount), "USDC to protocol...");
    
    const depositTx = await simplePerpV2.deposit(depositAmount);
    await depositTx.wait();
    console.log("✅ Funds deposited");
    
    // Check balance
    const balance = await simplePerpV2.balances(wallet.address);
    console.log("💼 Protocol balance:", ethers.formatEther(balance), "USDC");
    
  } catch (error) {
    console.error("❌ Setup failed:", (error as Error).message);
    throw error;
  }
}

async function executeTradeScenario(
  scenario: TradeScenario, 
  wallet: ethers.Wallet,
  scenarioIndex: number
): Promise<void> {
  console.log(`\n${scenarioIndex + 1}️⃣ ${scenario.description}`);
  
  const simplePerpV2 = new ethers.Contract(SIMPLEPERP_V2_ADDRESS, SIMPLEPERP_V2_ABI, wallet);
  const ratioOracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, wallet);
  
  try {
    // Get current ratio before trade
    console.log("📊 Current market state:");
    try {
      const currentRatio = await ratioOracle.getRatioShare(scenario.baseToken, scenario.quoteToken);
      const ethShare = Number(currentRatio) / 1e18 * 100;
      console.log(`   ${scenario.baseToken} Share: ${ethShare.toFixed(4)}%`);
      console.log(`   ${scenario.quoteToken} Share: ${(100 - ethShare).toFixed(4)}%`);
    } catch (error) {
      console.log("   ⚠️ Could not fetch current ratio (using stale prices)");
    }
    
    // Execute the trade
    console.log(`🎯 Opening ${scenario.isLong ? 'LONG' : 'SHORT'} position:`);
    console.log(`   Token Pair: ${scenario.baseToken}/${scenario.quoteToken}`);
    console.log(`   Notional: ${scenario.notional} USDC`);
    console.log(`   Direction: ${scenario.isLong ? 'Long ' + scenario.baseToken : 'Short ' + scenario.baseToken}`);
    
    const notionalAmount = ethers.parseEther(scenario.notional);
    
    const tradeTx = await simplePerpV2.openPosition(
      scenario.baseToken,
      scenario.quoteToken,
      notionalAmount,
      scenario.isLong,
      {
        gasLimit: 500000 // Generous gas limit
      }
    );
    
    console.log("📋 Transaction hash:", tradeTx.hash);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await tradeTx.wait();
    console.log("✅ Trade executed successfully!");
    console.log("⛽ Gas used:", receipt.gasUsed.toString());
    
    // Check position after trade
    try {
      const position = await simplePerpV2.getPosition(wallet.address);
      console.log("📈 Position opened:");
      console.log(`   Pair: ${position.baseToken}/${position.quoteToken}`);
      console.log(`   Notional: ${ethers.formatEther(position.notional)} USDC`);
      console.log(`   Direction: ${position.isLong ? 'LONG' : 'SHORT'}`);
      console.log(`   Entry Share: ${(Number(position.entryShare) / 1e18 * 100).toFixed(4)}%`);
    } catch (error) {
      console.log("⚠️ Could not fetch position details");
    }
    
    // Wait before next trade for dramatic effect
    if (scenario.delay > 0) {
      console.log(`⏸️  Waiting ${scenario.delay} seconds before next action...`);
      await new Promise(resolve => setTimeout(resolve, scenario.delay * 1000));
    }
    
  } catch (error) {
    console.error("❌ Trade failed:", (error as Error).message);
    
    if ((error as any).code === 'INSUFFICIENT_FUNDS') {
      console.log("💡 Insufficient funds - check USDC balance and deposits");
    } else if ((error as Error).message.includes("insufficient margin")) {
      console.log("💡 Insufficient margin for this trade size");
    } else if ((error as Error).message.includes("paused")) {
      console.log("💡 Protocol is paused");
    }
    
    throw error;
  }
}

async function runLiveTradingDemo(): Promise<void> {
  console.log("🎬 LIVE TRADING DEMO");
  console.log("===================");
  console.log("🏆 Demonstrating real-time ETH/BTC relative shares trading with Pyth Oracle");
  
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  
  console.log("📍 Demo wallet:", wallet.address);
  console.log("🌐 Network: Arbitrum Mainnet");
  
  try {
    // Step 1: Update Pyth prices for live demo
    console.log("\n🔄 Step 1: Updating Pyth prices for live demo...");
    await updatePythPrices();
    
    // Step 2: Setup demo funds
    console.log("\n💰 Step 2: Setting up demo trading funds...");
    await setupDemoFunds(wallet);
    
    // Step 3: Show initial market state
    console.log("\n📊 Step 3: Initial market state analysis...");
    await testPricesAndRatios();
    
    // Step 4: Execute trading scenarios
    console.log("\n🎯 Step 4: Executing live trading scenarios...");
    console.log("💡 Each trade will affect the relative shares between ETH and BTC");
    console.log("📈 Watch how the market ratios change with each position!");
    
    for (let i = 0; i < DEMO_SCENARIOS.length; i++) {
      await executeTradeScenario(DEMO_SCENARIOS[i], wallet, i);
      
      // Update prices between trades to show real-time data
      if (i < DEMO_SCENARIOS.length - 1) {
        console.log("\n🔄 Updating prices for next trade...");
        await updatePythPrices();
      }
    }
    
    // Step 5: Final market analysis
    console.log("\n📈 Step 5: Final market analysis...");
    await testPricesAndRatios();
    
    console.log("\n🎉 LIVE DEMO COMPLETE!");
    console.log("\n🏆 Pyth Oracle Integration Demonstrated:");
    console.log("   ✅ Real-time price feeds from Pyth Network");
    console.log("   ✅ Live trading with updated ratios");
    console.log("   ✅ On-chain position tracking");
    console.log("   ✅ Dynamic relative share calculations");
    console.log("   ✅ Full integration with Arbitrum mainnet");
    
    console.log("\n📊 Check your indexer and frontend to see:");
    console.log("   📈 Real-time position updates");
    console.log("   🔄 Dynamic ETH/BTC share changes");  
    console.log("   📊 Live market data visualization");
    
  } catch (error) {
    console.error("❌ Demo failed:", (error as Error).message);
    console.log("\n💡 Troubleshooting tips:");
    console.log("   1. Ensure you have ETH for gas fees");
    console.log("   2. Check that contracts are deployed correctly");
    console.log("   3. Verify Pyth oracle is functioning");
    console.log("   4. Make sure SimplePerpV2 is not paused");
  }
}

async function quickPriceUpdate(): Promise<void> {
  console.log("⚡ Quick price update for demo...");
  await updatePythPrices();
  await testPricesAndRatios();
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes("--quick-update")) {
    quickPriceUpdate()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  } else {
    runLiveTradingDemo()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  }
}

export { runLiveTradingDemo, quickPriceUpdate };