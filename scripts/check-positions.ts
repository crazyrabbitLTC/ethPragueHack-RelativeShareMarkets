import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const SIMPLEPERP_V2_ADDRESS = "0x99d45f0d21D135D0947F641Ae4C10E00DF820244";
const RATIO_ORACLE_ADDRESS = "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f";

const SIMPLEPERP_V2_ABI = [
  "function positions(address trader) external view returns (string baseToken, string quoteToken, uint256 notional, bool isLong, uint256 entryShare, uint256 openedAt, uint256 lastUpdated)",
  "function balances(address) external view returns (uint256)"
];

const RATIO_ORACLE_ABI = [
  "function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256)"
];

interface TestWallet {
  name: string;
  address: string;
}

async function checkPosition(provider: ethers.Provider, wallet: TestWallet) {
  console.log(`\n👤 ${wallet.name} (${wallet.address})`);
  console.log("─".repeat(60));
  
  const perp = new ethers.Contract(SIMPLEPERP_V2_ADDRESS, SIMPLEPERP_V2_ABI, provider);
  const oracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, provider);
  
  try {
    // Check position
    const position = await perp.positions(wallet.address);
    const hasPosition = position.notional > 0n;
    
    if (!hasPosition) {
      console.log("  No open position");
      
      // Check balance
      const balance = await perp.balances(wallet.address);
      if (balance > 0n) {
        console.log(`  Balance in perp: ${ethers.formatUnits(balance, 6)} USDC`);
      }
      return;
    }
    
    // Get current ratio
    const currentRatio = await oracle.getRatioShare(position.baseToken, position.quoteToken);
    const currentRatioPercent = Number(currentRatio) / 1e16;
    const entryRatioPercent = Number(position.entryShare) / 1e16;
    
    // Calculate PnL
    const notionalUSD = Number(ethers.formatUnits(position.notional, 6));
    const ratioChange = position.isLong 
      ? (currentRatioPercent - entryRatioPercent) / entryRatioPercent
      : (entryRatioPercent - currentRatioPercent) / entryRatioPercent;
    const pnlUSD = notionalUSD * ratioChange;
    const pnlPercent = ratioChange * 100;
    
    // Display position info
    console.log(`  📊 Position Details:`);
    console.log(`     Pair: ${position.baseToken}/${position.quoteToken}`);
    console.log(`     Type: ${position.isLong ? '🟢 LONG' : '🔴 SHORT'}`);
    console.log(`     Size: $${notionalUSD.toFixed(2)} USDC`);
    console.log(`     Entry: ${entryRatioPercent.toFixed(2)}% → Current: ${currentRatioPercent.toFixed(2)}%`);
    console.log(`     PnL: ${pnlUSD >= 0 ? '✅' : '❌'} ${pnlUSD >= 0 ? '+' : ''}$${pnlUSD.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
    console.log(`     Opened: ${new Date(Number(position.openedAt) * 1000).toLocaleString()}`);
    
    // Check balance
    const balance = await perp.balances(wallet.address);
    if (balance > 0n) {
      console.log(`     Balance: ${ethers.formatUnits(balance, 6)} USDC`);
    }
    
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log("📊 Checking All Positions on SimplePerpV2");
  console.log("==========================================");
  
  const provider = new ethers.JsonRpcProvider(
    `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  );
  
  const testWallets: TestWallet[] = [
    { name: "Alice", address: process.env.ALICE_ADDRESS! },
    { name: "Bob", address: process.env.BOB_ADDRESS! },
    { name: "Deployer", address: process.env.DEPLOYER_ADDRESS! },
    { name: "Funder", address: process.env.FUNDER_ADDRESS! }
  ];
  
  // Add custom address if provided
  const args = process.argv.slice(2);
  if (args.length > 0) {
    testWallets.push({ 
      name: "Custom", 
      address: args[0] 
    });
  }
  
  for (const wallet of testWallets) {
    await checkPosition(provider, wallet);
  }
  
  console.log("\n✅ Done!");
}

main().catch(console.error);