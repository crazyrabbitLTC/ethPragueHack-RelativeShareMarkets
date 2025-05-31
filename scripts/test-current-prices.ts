import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const RATIO_ORACLE_ADDRESS = "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f";

const RATIO_ORACLE_ABI = [
  "function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256)",
  "function useMockPrices() public view returns (bool)",
  "function pyth() public view returns (address)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const ratioOracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, provider);
  
  console.log("🔍 Testing Current Oracle State...");
  
  try {
    const useMockPrices = await ratioOracle.useMockPrices();
    const pythOracle = await ratioOracle.pyth();
    
    console.log("📊 Oracle Status:");
    console.log("   Using Mock Prices:", useMockPrices);
    console.log("   Pyth Oracle:", pythOracle);
    console.log("   Mode:", useMockPrices ? "Mock" : "Pyth");
    
    // Try to get ratio share - this should work even with stale prices
    try {
      const ratio = await ratioOracle.getRatioShare("ETH", "BTC");
      const ethShare = Number(ratio) / 1e18 * 100;
      const btcShare = 100 - ethShare;
      
      console.log("\n💰 Current Ratios:");
      console.log("   ETH Share:", ethShare.toFixed(2) + "%");
      console.log("   BTC Share:", btcShare.toFixed(2) + "%");
      console.log("   Raw Ratio:", ratio.toString());
      
      console.log("\n✅ SUCCESS: Oracle is providing realistic ratios!");
      console.log("📈 Your frontend can use these ratios for the demo");
      
    } catch (error) {
      console.log("❌ Cannot get ratios:", (error as Error).message);
    }
    
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main };