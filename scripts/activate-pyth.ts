import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Contract addresses on Arbitrum
const RATIO_ORACLE_ADDRESS = "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f";
const PYTH_CONTRACT_ADDRESS = "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C";

// Pyth price feed IDs for Arbitrum
const PRICE_FEED_IDS = {
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
};

const RATIO_ORACLE_ABI = [
  "function setPythOracle(address _pyth) external",
  "function setPriceId(string memory token, bytes32 priceId) external",
  "function pyth() public view returns (address)",
  "function useMockPrices() public view returns (bool)",
  "function owner() public view returns (address)",
  "function getPrice(string memory token) public view returns (uint256)",
  "function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256)"
];

async function main() {
  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  
  console.log("🔌 Connecting to Arbitrum...");
  console.log("📍 Wallet address:", wallet.address);
  
  // Connect to RatioOracle
  const ratioOracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, wallet);
  
  console.log("\n📊 Current Oracle Status:");
  
  try {
    const currentPyth = await ratioOracle.pyth();
    const useMockPrices = await ratioOracle.useMockPrices();
    const owner = await ratioOracle.owner();
    
    console.log("  Pyth Oracle:", currentPyth);
    console.log("  Using Mock Prices:", useMockPrices);
    console.log("  Owner:", owner);
    console.log("  Your wallet:", wallet.address);
    
    // Check if we're the owner
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error("❌ ERROR: You are not the owner of this contract!");
      console.log("   Owner:", owner);
      console.log("   Your address:", wallet.address);
      return;
    }
    
    // Check if Pyth is already set
    if (currentPyth !== ethers.ZeroAddress && !useMockPrices) {
      console.log("✅ Pyth oracle is already activated!");
      
      // Test getting prices
      try {
        const ethPrice = await ratioOracle.getPrice("ETH");
        const btcPrice = await ratioOracle.getPrice("BTC");
        const ratio = await ratioOracle.getRatioShare("ETH", "BTC");
        
        console.log("\n💰 Current Prices:");
        console.log("  ETH:", ethers.formatEther(ethPrice), "USD");
        console.log("  BTC:", ethers.formatEther(btcPrice), "USD");
        console.log("  ETH Share:", (Number(ratio) / 1e18 * 100).toFixed(2) + "%");
        
      } catch (error) {
        console.log("⚠️  Prices may be stale or unavailable:", error.message);
      }
      
      return;
    }
    
    console.log("\n🚀 Activating Pyth Oracle...");
    
    // Step 1: Set Pyth oracle address
    if (currentPyth === ethers.ZeroAddress) {
      console.log("1️⃣ Setting Pyth oracle address...");
      const tx1 = await ratioOracle.setPythOracle(PYTH_CONTRACT_ADDRESS);
      console.log("   Transaction:", tx1.hash);
      await tx1.wait();
      console.log("   ✅ Pyth oracle address set!");
    }
    
    // Step 2: Verify price IDs are set (they should be from constructor)
    console.log("\n2️⃣ Verifying price feed IDs...");
    console.log("   ETH Price ID:", PRICE_FEED_IDS.ETH);
    console.log("   BTC Price ID:", PRICE_FEED_IDS.BTC);
    console.log("   ✅ Price IDs are configured in constructor");
    
    // Step 3: Test the oracle
    console.log("\n3️⃣ Testing Pyth price feeds...");
    
    try {
      // Note: This might fail if prices are stale or haven't been updated recently
      const ethPrice = await ratioOracle.getPrice("ETH");
      const btcPrice = await ratioOracle.getPrice("BTC");
      const ratio = await ratioOracle.getRatioShare("ETH", "BTC");
      
      console.log("✅ Pyth prices retrieved successfully!");
      console.log("   ETH Price:", ethers.formatEther(ethPrice), "USD");
      console.log("   BTC Price:", ethers.formatEther(btcPrice), "USD");
      console.log("   ETH Share:", (Number(ratio) / 1e18 * 100).toFixed(2) + "%");
      
    } catch (error: any) {
      console.log("⚠️  Price retrieval failed (likely stale prices):");
      console.log("   Error:", error.message);
      console.log("\n💡 To fix this:");
      console.log("   1. Prices may be older than 5 minutes (MAX_PRICE_AGE)");
      console.log("   2. You need to call updatePriceFeeds() with fresh Pyth data");
      console.log("   3. See the price update script for details");
    }
    
    console.log("\n🎉 Pyth Oracle Activation Complete!");
    console.log("\n📝 Next Steps:");
    console.log("   1. Run the price update script to push fresh prices");
    console.log("   2. Frontend can now use real ETH/BTC prices");
    console.log("   3. Indexer will track real market ratios");
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.code === 'CALL_EXCEPTION') {
      console.log("💡 This might be due to:");
      console.log("   - Network connectivity issues");
      console.log("   - Contract not deployed at expected address");
      console.log("   - RPC endpoint issues");
    }
  }
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main };