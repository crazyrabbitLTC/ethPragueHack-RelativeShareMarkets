import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const SIMPLEPERP_V2_ADDRESS = "0x99d45f0d21D135D0947F641Ae4C10E00DF820244";
const MOCK_USDC_ADDRESS = "0xe2696990894452AbE9ce45ba557979c2cbc6B3dd";

// Updated ABI based on the actual contract
const SIMPLEPERP_V2_ABI = [
  "function positions(address trader) external view returns (string baseToken, string quoteToken, uint256 notional, bool isLong, uint256 entryShare, uint256 openedAt, uint256 lastUpdated)",
  "function closePosition() external",
  "function forceClosePosition(address trader) external", // Emergency close
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function balances(address) external view returns (uint256)",
  "function isPaused() external view returns (bool)",
  "function emergencyWithdraw() external",
  "event PositionClosed(address indexed user, uint256 notional, int256 realizedPnL, uint256 exitRatio)"
];

const MOCK_USDC_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external"
];

interface TestWallet {
  name: string;
  privateKey: string;
  address: string;
}

async function closePositionForWallet(wallet: TestWallet) {
  console.log(`\n🔍 Checking ${wallet.name} (${wallet.address})...`);
  
  const provider = new ethers.JsonRpcProvider(
    `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  );
  
  const signer = new ethers.Wallet(wallet.privateKey, provider);
  const perp = new ethers.Contract(SIMPLEPERP_V2_ADDRESS, SIMPLEPERP_V2_ABI, signer);
  const usdc = new ethers.Contract(MOCK_USDC_ADDRESS, MOCK_USDC_ABI, signer);
  
  try {
    // Check if wallet has a position
    const position = await perp.positions(wallet.address);
    const hasPosition = position.notional > 0n;
    
    if (!hasPosition) {
      console.log(`  ✅ No open position`);
      return;
    }
    
    // Log position details
    console.log(`  📊 Found open position:`);
    console.log(`     - Pair: ${position.baseToken}/${position.quoteToken}`);
    console.log(`     - Size: ${ethers.formatUnits(position.notional, 6)} USDC`);
    console.log(`     - Type: ${position.isLong ? 'LONG' : 'SHORT'}`);
    console.log(`     - Entry Share: ${(Number(position.entryShare) / 1e16).toFixed(2)}%`);
    console.log(`     - Opened: ${new Date(Number(position.openedAt) * 1000).toLocaleString()}`);
    
    // Get current balance before closing
    const balanceBefore = await perp.balances(wallet.address);
    console.log(`     - Balance in perp: ${ethers.formatUnits(balanceBefore, 6)} USDC`);
    
    // Close the position
    console.log(`\n  🔄 Closing position...`);
    const tx = await perp.closePosition();
    console.log(`  📝 Transaction: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`  ✅ Position closed! (Block: ${receipt.blockNumber})`);
    
    // Check final balance
    const balanceAfter = await perp.balances(wallet.address);
    const pnl = Number(ethers.formatUnits(balanceAfter, 6)) - Number(ethers.formatUnits(balanceBefore, 6));
    console.log(`     - Final balance in perp: ${ethers.formatUnits(balanceAfter, 6)} USDC`);
    console.log(`     - PnL: ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)} USDC`);
    
    // Optionally withdraw funds
    if (balanceAfter > 0n) {
      console.log(`\n  💰 Withdrawing funds...`);
      const withdrawTx = await perp.withdraw(balanceAfter);
      await withdrawTx.wait();
      console.log(`  ✅ Withdrawn ${ethers.formatUnits(balanceAfter, 6)} USDC`);
    }
    
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log("🧹 Closing All Test Positions");
  console.log("================================\n");
  
  const testWallets: TestWallet[] = [
    {
      name: "Alice",
      privateKey: process.env.ALICE_PRIVATE_KEY!,
      address: process.env.ALICE_ADDRESS!
    },
    {
      name: "Bob", 
      privateKey: process.env.BOB_PRIVATE_KEY!,
      address: process.env.BOB_ADDRESS!
    },
    {
      name: "Deployer",
      privateKey: process.env.PRIVATE_KEY!,
      address: process.env.DEPLOYER_ADDRESS!
    }
  ];
  
  // Check if user wants to close specific wallet or all
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const walletName = args[0].toLowerCase();
    const wallet = testWallets.find(w => w.name.toLowerCase() === walletName);
    if (wallet) {
      await closePositionForWallet(wallet);
    } else {
      console.error(`Unknown wallet: ${args[0]}`);
      console.log(`Available wallets: ${testWallets.map(w => w.name).join(', ')}`);
    }
  } else {
    // Close all positions
    for (const wallet of testWallets) {
      await closePositionForWallet(wallet);
    }
  }
  
  console.log("\n✅ Done!");
}

main().catch(console.error);