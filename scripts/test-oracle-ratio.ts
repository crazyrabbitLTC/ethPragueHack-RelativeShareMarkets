import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Contract address
const RATIO_ORACLE_ADDRESS = "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f";

const RATIO_ORACLE_ABI = [
  "function getPrice(string memory token) public view returns (uint256)",
  "function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256)",
  "function priceIds(string memory token) public view returns (bytes32)",
  "function useMockPrices() public view returns (bool)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const ratioOracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, provider);
  
  console.log("🧪 Testing RatioOracle...\n");
  
  try {
    // Check if using mock prices
    const useMockPrices = await ratioOracle.useMockPrices();
    console.log("Using Mock Prices:", useMockPrices);
    
    // Test individual price calls
    console.log("\n📊 Testing individual prices:");
    
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
    
    // Test ratio calculation
    console.log("\n📊 Testing ratio calculation:");
    
    try {
      const ratio = await ratioOracle.getRatioShare("ETH", "BTC");
      console.log("ETH/BTC Ratio:", (Number(ratio) / 1e18 * 100).toFixed(2) + "%");
    } catch (e: any) {
      console.log("Ratio Error:", e.message);
    }
    
    // Check price IDs for various tokens
    console.log("\n🔍 Checking price IDs:");
    const tokens = ["ETH", "BTC", "eth", "btc", "Eth", "Btc"];
    
    for (const token of tokens) {
      try {
        const priceId = await ratioOracle.priceIds(token);
        console.log(`${token}: ${priceId}`);
      } catch (e: any) {
        console.log(`${token}: Error - ${e.message}`);
      }
    }
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);