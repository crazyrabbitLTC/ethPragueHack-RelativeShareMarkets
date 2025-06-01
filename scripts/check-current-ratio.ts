import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const RATIO_ORACLE_ADDRESS = "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f";

const RATIO_ORACLE_ABI = [
  "function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256)",
  "function getPrice(string memory token) public view returns (uint256)",
  "function useMockPrices() public view returns (bool)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const ratioOracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, provider);
  
  console.log("🔍 Checking current ratio...\n");
  
  try {
    const useMockPrices = await ratioOracle.useMockPrices();
    console.log("Using Mock Prices:", useMockPrices);
    
    // Try to get individual prices
    try {
      const ethPrice = await ratioOracle.getPrice("ETH");
      console.log("ETH Price:", ethers.formatEther(ethPrice), "USD");
    } catch (e: any) {
      console.log("ETH Price Error:", e.message);
    }
    
    try {
      const btcPrice = await ratioOracle.getPrice("BTC");
      console.log("BTC Price:", ethers.formatEther(btcPrice), "USD");
    } catch (e: any) {
      console.log("BTC Price Error:", e.message);
    }
    
    // Try to get ratio
    try {
      const ratio = await ratioOracle.getRatioShare("ETH", "BTC");
      console.log("\nRatio Share (raw):", ratio.toString());
      console.log("Ratio Share (%):", (Number(ratio) / 1e18 * 100).toFixed(4) + "%");
    } catch (e: any) {
      console.log("\nRatio Error:", e.message);
      if (e.message.includes("Price too stale")) {
        console.log("\n⚠️  Prices are stale! Update them with: npm run update-prices");
      }
    }
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);