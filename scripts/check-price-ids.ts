import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

// Load keys from keys.json
const keysPath = path.join(__dirname, "..", "keys.json");
const keys = JSON.parse(fs.readFileSync(keysPath, "utf-8"));

// Contract addresses
const RATIO_ORACLE_ADDRESS = "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f";

// Expected Pyth price feed IDs
const EXPECTED_PRICE_IDS = {
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
};

const RATIO_ORACLE_ABI = [
  "function priceIds(string memory token) public view returns (bytes32)",
  "function setPriceId(string memory token, bytes32 priceId) external",
  "function owner() public view returns (address)",
  "function useMockPrices() public view returns (bool)"
];

async function main() {
  // Use deployer key from keys.json
  const deployerPrivateKey = keys.wallets.deployer.privateKey;
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const wallet = new ethers.Wallet(deployerPrivateKey, provider);
  
  console.log("🔍 Checking Price IDs on RatioOracle...");
  console.log("📍 Oracle address:", RATIO_ORACLE_ADDRESS);
  console.log("👤 Using wallet:", wallet.address);
  console.log("");
  
  const ratioOracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, wallet);
  
  try {
    // Check current state
    const owner = await ratioOracle.owner();
    const useMockPrices = await ratioOracle.useMockPrices();
    
    console.log("📊 Oracle Status:");
    console.log("  Owner:", owner);
    console.log("  Using Mock Prices:", useMockPrices);
    console.log("");
    
    // Check price IDs
    console.log("🔍 Checking Price IDs:");
    
    for (const [token, expectedId] of Object.entries(EXPECTED_PRICE_IDS)) {
      const currentId = await ratioOracle.priceIds(token);
      const hexId = currentId.toString();
      
      console.log(`\n${token}:`);
      console.log(`  Current:  ${hexId}`);
      console.log(`  Expected: ${expectedId}`);
      
      if (hexId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log(`  ❌ NOT SET!`);
        
        // Set the price ID if we're the owner
        if (owner.toLowerCase() === wallet.address.toLowerCase()) {
          console.log(`  🔧 Setting price ID...`);
          const tx = await ratioOracle.setPriceId(token, expectedId);
          console.log(`  📝 Transaction: ${tx.hash}`);
          await tx.wait();
          console.log(`  ✅ Price ID set!`);
        } else {
          console.log(`  ⚠️  Cannot set - not the owner`);
        }
      } else if (hexId.toLowerCase() === expectedId.toLowerCase()) {
        console.log(`  ✅ Correct!`);
      } else {
        console.log(`  ⚠️  Different ID set`);
      }
    }
    
    console.log("\n✨ Price ID check complete!");
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
  }
}

main().catch(console.error);