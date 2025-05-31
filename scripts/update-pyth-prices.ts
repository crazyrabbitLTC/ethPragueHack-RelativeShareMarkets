import { ethers } from "ethers";
import * as dotenv from "dotenv";
import axios from "axios";

dotenv.config();

// Contract addresses
const RATIO_ORACLE_ADDRESS = "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f";

// Pyth price feed IDs
const PRICE_FEED_IDS = {
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
};

const RATIO_ORACLE_ABI = [
  "function updatePriceFeeds(bytes[] calldata priceUpdateData) external payable",
  "function getUpdateFee(bytes[] calldata priceUpdateData) external view returns (uint256)",
  "function getPrice(string memory token) public view returns (uint256)",
  "function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256)",
  "function useMockPrices() public view returns (bool)"
];

async function fetchPythPriceData(): Promise<string[]> {
  try {
    console.log("📡 Fetching latest price data from Pyth...");
    
    // Fetch price updates from Pyth Hermes API
    const priceIds = [PRICE_FEED_IDS.ETH, PRICE_FEED_IDS.BTC];
    const response = await axios.get(`https://hermes.pyth.network/api/latest_price_feeds`, {
      params: {
        ids: priceIds,
        binary: true
      },
      responseType: 'json'
    });
    
    if (response.data && response.data.binary && response.data.binary.data) {
      console.log("✅ Price data fetched successfully");
      return response.data.binary.data;
    } else {
      throw new Error("Invalid response format from Pyth API");
    }
    
  } catch (error: any) {
    console.error("❌ Failed to fetch price data:", error.message);
    
    // Return mock data for testing
    console.log("🔄 Using mock price update data for testing...");
    return [
      "0x", // Mock price update data would go here
      "0x"  // In a real implementation, you'd get this from Pyth
    ];
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  
  console.log("🔌 Connecting to Arbitrum...");
  console.log("📍 Wallet address:", wallet.address);
  
  const ratioOracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, wallet);
  
  try {
    // Check if we're in mock mode
    const useMockPrices = await ratioOracle.useMockPrices();
    
    if (useMockPrices) {
      console.log("⚠️  Oracle is in mock mode. Run activate-pyth.ts first!");
      return;
    }
    
    console.log("📊 Current prices before update:");
    try {
      const ethPrice = await ratioOracle.getPrice("ETH");
      const btcPrice = await ratioOracle.getPrice("BTC");
      const ratio = await ratioOracle.getRatioShare("ETH", "BTC");
      
      console.log("   ETH:", ethers.formatEther(ethPrice), "USD");
      console.log("   BTC:", ethers.formatEther(btcPrice), "USD");
      console.log("   ETH Share:", (Number(ratio) / 1e18 * 100).toFixed(2) + "%");
    } catch (error) {
      console.log("   ⚠️ Prices are stale or unavailable");
    }
    
    // Fetch fresh price data
    const priceUpdateData = await fetchPythPriceData();
    
    if (priceUpdateData.length === 0 || priceUpdateData.every(data => data === "0x")) {
      console.log("❌ No valid price data available. Cannot update prices.");
      console.log("\n💡 For demo purposes, you can:");
      console.log("   1. Use mock prices for now");
      console.log("   2. Implement proper Pyth price fetching later");
      return;
    }
    
    // Get update fee
    console.log("\n💰 Calculating update fee...");
    const updateFee = await ratioOracle.getUpdateFee(priceUpdateData);
    console.log("   Update fee:", ethers.formatEther(updateFee), "ETH");
    
    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log("   Wallet balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < updateFee) {
      console.error("❌ Insufficient balance to pay update fee!");
      return;
    }
    
    // Update prices
    console.log("\n🚀 Updating prices...");
    const tx = await ratioOracle.updatePriceFeeds(priceUpdateData, {
      value: updateFee
    });
    
    console.log("   Transaction:", tx.hash);
    console.log("   Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("   ✅ Price update confirmed!");
    console.log("   Gas used:", receipt.gasUsed.toString());
    
    // Check updated prices
    console.log("\n📊 Updated prices:");
    const ethPrice = await ratioOracle.getPrice("ETH");
    const btcPrice = await ratioOracle.getPrice("BTC");
    const ratio = await ratioOracle.getRatioShare("ETH", "BTC");
    
    console.log("   ETH:", ethers.formatEther(ethPrice), "USD");
    console.log("   BTC:", ethers.formatEther(btcPrice), "USD");
    console.log("   ETH Share:", (Number(ratio) / 1e18 * 100).toFixed(2) + "%");
    
    console.log("\n🎉 Price update complete!");
    
  } catch (error: any) {
    console.error("❌ Error updating prices:", error.message);
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log("💡 You need more ETH to pay for the price update fee");
    } else if (error.message.includes("Price too stale")) {
      console.log("💡 The current prices are too old. This update should fix it.");
    }
  }
}

// Simple demo function that uses mock prices if Pyth isn't available
async function demoWithMockPrices() {
  console.log("\n🎭 Demo Mode: Using mock prices");
  console.log("   ETH: $3,500 (mock)");
  console.log("   BTC: $95,000 (mock)");
  console.log("   ETH Share: ~3.5% (3500/(3500+95000))");
  console.log("\n💡 This shows how the system would work with real prices");
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      demoWithMockPrices();
      process.exit(1);
    });
}

export { main, demoWithMockPrices };