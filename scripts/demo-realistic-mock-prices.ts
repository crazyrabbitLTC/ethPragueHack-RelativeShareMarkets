import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const RATIO_ORACLE_ADDRESS = "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f";

const RATIO_ORACLE_ABI = [
  "function setPrice(string memory token, uint256 price) external",
  "function getPrice(string memory token) public view returns (uint256)",
  "function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256)",
  "function useMockPrices() public view returns (bool)"
];

// Realistic current crypto prices (scaled to 1e18)
const REALISTIC_PRICES = {
  ETH: ethers.parseEther("3500"),    // $3,500
  BTC: ethers.parseEther("95000")    // $95,000
};

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  
  console.log("🎭 Setting Realistic Mock Prices for Demo");
  console.log("📍 Wallet address:", wallet.address);
  
  const ratioOracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, wallet);
  
  try {
    // Check if we're in mock mode
    const useMockPrices = await ratioOracle.useMockPrices();
    
    if (!useMockPrices) {
      console.log("⚠️  Oracle is in Pyth mode. This script is for mock mode only.");
      console.log("   If you want to use mock prices, you need to redeploy or modify the contract.");
      return;
    }
    
    console.log("✅ Oracle is in mock mode");
    
    // Set realistic prices
    console.log("\n💰 Setting realistic prices:");
    
    console.log("1️⃣ Setting ETH price to $3,500...");
    const tx1 = await ratioOracle.setPrice("ETH", REALISTIC_PRICES.ETH);
    await tx1.wait();
    console.log("   ✅ ETH price set");
    
    console.log("2️⃣ Setting BTC price to $95,000...");
    const tx2 = await ratioOracle.setPrice("BTC", REALISTIC_PRICES.BTC);
    await tx2.wait();
    console.log("   ✅ BTC price set");
    
    // Verify prices
    console.log("\n📊 Current mock prices:");
    const ethPrice = await ratioOracle.getPrice("ETH");
    const btcPrice = await ratioOracle.getPrice("BTC");
    const ratio = await ratioOracle.getRatioShare("ETH", "BTC");
    
    console.log("   ETH:", ethers.formatEther(ethPrice), "USD");
    console.log("   BTC:", ethers.formatEther(btcPrice), "USD");
    console.log("   ETH Share:", (Number(ratio) / 1e18 * 100).toFixed(2) + "%");
    console.log("   BTC Share:", (100 - Number(ratio) / 1e18 * 100).toFixed(2) + "%");
    
    // Calculate some interesting stats
    const ethValue = Number(ethers.formatEther(ethPrice));
    const btcValue = Number(ethers.formatEther(btcPrice));
    const btcToEthRatio = btcValue / ethValue;
    
    console.log("\n📈 Market Analysis:");
    console.log("   BTC/ETH Ratio:", btcToEthRatio.toFixed(2) + "x");
    console.log("   1 BTC = " + btcToEthRatio.toFixed(2) + " ETH");
    console.log("   Market Cap Weighted ETH Share: " + (Number(ratio) / 1e18 * 100).toFixed(2) + "%");
    
    console.log("\n🎉 Realistic mock prices set successfully!");
    console.log("\n💡 Now your indexer and frontend will use realistic price ratios");
    console.log("   Perfect for demonstrating the ETH/BTC share tracking!");
    
  } catch (error: any) {
    console.error("❌ Error setting mock prices:", error.message);
  }
}

// Function to simulate price movements for demo
async function simulatePriceMovements() {
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const ratioOracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, wallet);
  
  console.log("\n🎬 Simulating price movements for demo...");
  
  const movements = [
    { eth: 3600, btc: 96000, desc: "Bull market surge" },
    { eth: 3400, btc: 94000, desc: "Small correction" },
    { eth: 3700, btc: 97000, desc: "Recovery rally" },
    { eth: 3500, btc: 95000, desc: "Back to baseline" }
  ];
  
  for (let i = 0; i < movements.length; i++) {
    const move = movements[i];
    console.log(`\n${i + 1}️⃣ ${move.desc}:`);
    
    await ratioOracle.setPrice("ETH", ethers.parseEther(move.eth.toString()));
    await ratioOracle.setPrice("BTC", ethers.parseEther(move.btc.toString()));
    
    const ratio = await ratioOracle.getRatioShare("ETH", "BTC");
    console.log(`   ETH: $${move.eth} | BTC: $${move.btc} | ETH Share: ${(Number(ratio) / 1e18 * 100).toFixed(2)}%`);
    
    // Wait a bit for dramatic effect
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log("\n✨ Price simulation complete!");
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes("--simulate")) {
    main()
      .then(() => simulatePriceMovements())
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  } else {
    main()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  }
}

export { main, simulatePriceMovements };