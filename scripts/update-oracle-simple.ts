import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const RATIO_ORACLE_ADDRESS = "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f";

const RATIO_ORACLE_ABI = [
  "function updatePrice(uint256 ethPrice, uint256 btcPrice, uint256 timestamp) external",
  "function currentRatio() external view returns (uint256)",
  "function lastUpdateTimestamp() external view returns (uint256)"
];

async function updateOraclePrice() {
  console.log("🔄 Updating Oracle Prices...\n");
  
  const provider = new ethers.JsonRpcProvider(
    `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  );
  
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const oracle = new ethers.Contract(RATIO_ORACLE_ADDRESS, RATIO_ORACLE_ABI, wallet);
  
  try {
    // Check last update
    const lastUpdate = await oracle.lastUpdateTimestamp();
    const lastUpdateDate = new Date(Number(lastUpdate) * 1000);
    console.log(`📅 Last update: ${lastUpdateDate.toLocaleString()}`);
    
    // Use realistic current prices
    const ethPrice = ethers.parseUnits("2542.47", 18);  // $2,542.47
    const btcPrice = ethers.parseUnits("104710.62", 18); // $104,710.62
    const timestamp = Math.floor(Date.now() / 1000);
    
    console.log("\n💰 Updating with current prices:");
    console.log(`   ETH: $2,542.47`);
    console.log(`   BTC: $104,710.62`);
    console.log(`   Timestamp: ${new Date(timestamp * 1000).toLocaleString()}`);
    
    // Calculate expected ratio
    const ethShare = (Number(ethPrice) * 100) / (Number(ethPrice) + Number(btcPrice));
    console.log(`   Expected ETH share: ${ethShare.toFixed(2)}%`);
    
    // Update prices
    const tx = await oracle.updatePrice(ethPrice, btcPrice, timestamp);
    console.log(`\n📝 Transaction: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ Price updated! (Block: ${receipt.blockNumber})`);
    
    // Verify update
    const newRatio = await oracle.currentRatio();
    const newRatioPercent = Number(newRatio) / 1e16;
    console.log(`\n📊 New ETH share: ${newRatioPercent.toFixed(2)}%`);
    
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }
}

updateOraclePrice().catch(console.error);