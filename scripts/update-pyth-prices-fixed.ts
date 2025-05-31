import { ethers } from "ethers";
import * as dotenv from "dotenv";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

// Load keys from keys.json
const keysPath = path.join(__dirname, "..", "keys.json");
const keys = JSON.parse(fs.readFileSync(keysPath, "utf-8"));

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

async function fetchPythPriceData() {
  try {
    console.log("📡 Fetching latest price data from Pyth...");
    
    // Fetch VAAs (Verified Action Approvals) for each price ID
    const priceIds = [PRICE_FEED_IDS.ETH, PRICE_FEED_IDS.BTC];
    const url = `https://hermes.pyth.network/api/latest_vaas?ids[]=${priceIds[0]}&ids[]=${priceIds[1]}`;
    
    console.log("   Fetching from:", url);
    const response = await axios.get(url);
    
    if (!response.data || response.data.length === 0) {
      throw new Error("No VAA data received from Pyth");
    }
    
    // Convert base64 VAAs to hex format
    const priceUpdateData = response.data.map((vaaItem: any) => {
      if (!vaaItem || !vaaItem.vaa) {
        throw new Error("Invalid VAA data structure");
      }
      const base64 = vaaItem.vaa;
      const buffer = Buffer.from(base64, 'base64');
      return '0x' + buffer.toString('hex');
    });
    
    console.log("✅ Price data fetched successfully");
    console.log(`   Found ${priceUpdateData.length} price updates`);
    
    return priceUpdateData;
    
  } catch (error: any) {
    console.error("❌ Failed to fetch price data:", error.message);
    throw error;
  }
}

async function main() {
  // Use deployer key from keys.json
  const deployerPrivateKey = keys.wallets.deployer.privateKey;
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const wallet = new ethers.Wallet(deployerPrivateKey, provider);
  
  console.log("🔌 Connecting to Arbitrum...");
  console.log("📍 Using deployer wallet:", wallet.address);
  
  const ratioOracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, wallet);
  
  try {
    // Check if we're in mock mode
    const useMockPrices = await ratioOracle.useMockPrices();
    
    if (useMockPrices) {
      console.log("⚠️  Oracle is in mock mode. Run activate-pyth first!");
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
    console.log("   ✅ Prices updated in block:", receipt.blockNumber);
    
    // Check new prices
    console.log("\n📊 New prices after update:");
    const newEthPrice = await ratioOracle.getPrice("ETH");
    const newBtcPrice = await ratioOracle.getPrice("BTC");
    const newRatio = await ratioOracle.getRatioShare("ETH", "BTC");
    
    console.log("   ETH:", ethers.formatEther(newEthPrice), "USD");
    console.log("   BTC:", ethers.formatEther(newBtcPrice), "USD");
    console.log("   ETH Share:", (Number(newRatio) / 1e18 * 100).toFixed(2) + "%");
    
    console.log("\n✅ Oracle prices updated successfully!");
    console.log("   You can now trade with fresh prices for the next 5 minutes");
    
  } catch (error: any) {
    console.error("❌ Error updating prices:", error.message);
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log("💡 You need more ETH to pay for the price update fee");
    } else if (error.message.includes("Price too stale")) {
      console.log("💡 The current prices are too old. This update should fix it.");
    }
  }
}

main().catch(console.error);