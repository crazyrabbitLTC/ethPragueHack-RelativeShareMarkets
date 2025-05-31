import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Contract addresses
const SIMPLE_PERP_ADDRESS = "0x99d45f0d21D135D0947F641Ae4C10E00DF820244";
const RATIO_ORACLE_ADDRESS = "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f";

// User address
const USER_ADDRESS = "0xE8D848debB3A3e12AA815b15900c8E020B863F31";

const SIMPLE_PERP_ABI = [
  "function positions(address user) view returns (string baseToken, string quoteToken, uint256 notional, bool isLong, uint256 entryShare, uint256 openedAt, uint256 lastUpdated)",
  "function balances(address user) view returns (uint256)"
];

const RATIO_ORACLE_ABI = [
  "function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  
  console.log("🔍 Checking position for user:", USER_ADDRESS);
  console.log("");
  
  const perp = new ethers.Contract(SIMPLE_PERP_ADDRESS, SIMPLE_PERP_ABI, provider);
  const oracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, provider);
  
  try {
    // Get position data
    const position = await perp.positions(USER_ADDRESS);
    const balance = await perp.balances(USER_ADDRESS);
    
    console.log("📊 Position Data:");
    console.log("  Base Token:", position.baseToken);
    console.log("  Quote Token:", position.quoteToken);
    console.log("  Notional:", ethers.formatUnits(position.notional, 6), "USDC");
    console.log("  Is Long:", position.isLong);
    console.log("  Entry Share (raw):", position.entryShare.toString());
    console.log("  Entry Share (%):", (Number(position.entryShare) / 1e18 * 100).toFixed(4) + "%");
    console.log("  Opened At:", new Date(Number(position.openedAt) * 1000).toISOString());
    console.log("");
    
    console.log("💰 Balance:", ethers.formatUnits(balance, 6), "USDC");
    console.log("");
    
    // Get current ratio
    if (position.notional > 0n) {
      const currentShare = await oracle.getRatioShare(position.baseToken, position.quoteToken);
      console.log("📈 Current Share (raw):", currentShare.toString());
      console.log("📈 Current Share (%):", (Number(currentShare) / 1e18 * 100).toFixed(4) + "%");
      
      // Calculate PnL
      const entryShareNum = Number(position.entryShare) / 1e18;
      const currentShareNum = Number(currentShare) / 1e18;
      const notionalNum = Number(position.notional) / 1e6;
      
      const shareChange = position.isLong 
        ? (currentShareNum - entryShareNum) / entryShareNum
        : (entryShareNum - currentShareNum) / entryShareNum;
        
      const pnlUsd = notionalNum * shareChange;
      const pnlPercent = shareChange * 100;
      
      console.log("");
      console.log("💵 P&L Calculation:");
      console.log("  Entry:", (entryShareNum * 100).toFixed(4) + "%");
      console.log("  Current:", (currentShareNum * 100).toFixed(4) + "%");
      console.log("  P&L USD:", pnlUsd.toFixed(2));
      console.log("  P&L %:", pnlPercent.toFixed(2) + "%");
    }
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);