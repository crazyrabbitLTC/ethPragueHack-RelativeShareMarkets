import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

// Load keys from keys.json
const keysPath = path.join(__dirname, "..", "keys.json");
const keys = JSON.parse(fs.readFileSync(keysPath, "utf-8"));

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
  console.log("🚀 Activating Pyth Oracle for REAL hackathon testing!");
  console.log("");
  
  // Use deployer key from keys.json
  const deployerPrivateKey = keys.wallets.deployer.privateKey;
  const deployerAddress = keys.wallets.deployer.address;
  
  console.log("📍 Using deployer wallet from keys.json:");
  console.log("   Address:", deployerAddress);
  console.log("");
  
  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const wallet = new ethers.Wallet(deployerPrivateKey, provider);
  
  // Verify the wallet address matches
  if (wallet.address.toLowerCase() !== deployerAddress.toLowerCase()) {
    console.error("❌ ERROR: Private key doesn't match expected address!");
    return;
  }
  
  console.log("🔌 Connecting to Arbitrum...");
  
  // Connect to RatioOracle
  const ratioOracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, wallet);
  
  console.log("📊 Current Oracle Status:");
  
  try {
    const currentPyth = await ratioOracle.pyth();
    const useMockPrices = await ratioOracle.useMockPrices();
    const owner = await ratioOracle.owner();
    
    console.log("  Pyth Oracle:", currentPyth);
    console.log("  Using Mock Prices:", useMockPrices);
    console.log("  Contract Owner:", owner);
    console.log("  Deployer Wallet:", wallet.address);
    
    // Check if we're the owner
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error("\n❌ ERROR: Deployer is not the owner of this contract!");
      console.log("   Contract Owner:", owner);
      console.log("   Deployer Address:", wallet.address);
      return;
    }
    
    console.log("✅ Deployer is the contract owner!");
    
    // Check if Pyth is already set
    if (currentPyth !== ethers.ZeroAddress && !useMockPrices) {
      console.log("\n✅ Pyth oracle is already activated!");
      
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
        console.log("⚠️  Prices may be stale or unavailable. Run: npm run update-prices");
      }
      
      return;
    }
    
    console.log("\n🚀 Activating Pyth Oracle...");
    
    // Set Pyth oracle address
    console.log("1️⃣ Setting Pyth oracle address...");
    const tx = await ratioOracle.setPythOracle(PYTH_CONTRACT_ADDRESS);
    console.log("   Transaction:", tx.hash);
    console.log("   Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("   ✅ Pyth oracle activated in block:", receipt.blockNumber);
    
    // Verify the change
    const newUseMockPrices = await ratioOracle.useMockPrices();
    const newPyth = await ratioOracle.pyth();
    
    console.log("\n🎉 Success! Oracle Status:");
    console.log("   Pyth Address:", newPyth);
    console.log("   Using Mock Prices:", newUseMockPrices, "(should be false)");
    
    console.log("\n📝 Next Steps:");
    console.log("1. Prices now expire after 5 minutes");
    console.log("2. Update prices before trading:");
    console.log("   - Click 'Update Oracle Prices' button in the UI");
    console.log("   - Or run: npm run update-prices");
    console.log("\n🚀 You're ready for REAL trading with live Pyth prices!");
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.message.includes("INSUFFICIENT_FUNDS")) {
      console.log("💡 The deployer wallet needs ETH for gas");
    }
  }
}

main().catch(console.error);