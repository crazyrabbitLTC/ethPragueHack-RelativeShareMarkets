import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

interface WalletFunding {
  name: string;
  address: string;
  amount: string; // in ETH
}

async function fundWalletsMinimal() {
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     💰 Minimal Funding for Deployment${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);
  
  // Setup provider
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc');
  
  // Setup funder wallet
  const funderPrivateKey = process.env.FUNDER_PRIVATE_KEY;
  if (!funderPrivateKey) {
    console.error(`${colors.red}❌ FUNDER_PRIVATE_KEY not found in .env${colors.reset}`);
    console.log('Run: npm run setup-keys first');
    process.exit(1);
  }
  
  const funder = new ethers.Wallet(`0x${funderPrivateKey}`, provider);
  
  // Check funder balance
  const funderBalance = await provider.getBalance(funder.address);
  console.log(`${colors.yellow}Funder Balance:${colors.reset} ${ethers.formatEther(funderBalance)} ETH`);
  
  if (funderBalance === 0n) {
    console.error(`${colors.red}❌ Funder wallet has no ETH!${colors.reset}`);
    console.log(`Please send ETH to: ${colors.green}${funder.address}${colors.reset}`);
    process.exit(1);
  }
  
  // MINIMAL funding - just deployer
  const walletsToFund: WalletFunding[] = [
    {
      name: 'Deployer',
      address: process.env.DEPLOYER_ADDRESS!,
      amount: '0.015' // Reduced for just deployment
    }
  ];
  
  // Calculate total needed
  const totalNeeded = walletsToFund.reduce((sum, w) => sum + parseFloat(w.amount), 0);
  const totalNeededWei = ethers.parseEther(totalNeeded.toString());
  
  // Add small gas buffer
  const gasBuffer = ethers.parseEther('0.002');
  const totalWithGas = totalNeededWei + gasBuffer;
  
  if (funderBalance < totalWithGas) {
    console.error(`${colors.red}❌ Insufficient funds!${colors.reset}`);
    console.log(`Need: ${ethers.formatEther(totalWithGas)} ETH (${totalNeeded} + 0.002 gas)`);
    console.log(`Have: ${ethers.formatEther(funderBalance)} ETH`);
    process.exit(1);
  }
  
  console.log(`\n${colors.green}✅ Sufficient funds available${colors.reset}`);
  console.log(`Total to distribute: ${totalNeeded} ETH`);
  console.log(`Gas buffer: 0.002 ETH`);
  console.log(`${colors.yellow}Note: Only funding deployer wallet (minimal mode)${colors.reset}\n`);
  
  // Fund each wallet
  for (const wallet of walletsToFund) {
    try {
      console.log(`${colors.yellow}Funding ${wallet.name}...${colors.reset}`);
      
      // Check current balance
      const currentBalance = await provider.getBalance(wallet.address);
      console.log(`  Current balance: ${ethers.formatEther(currentBalance)} ETH`);
      
      if (currentBalance >= ethers.parseEther(wallet.amount)) {
        console.log(`  ${colors.green}✓ Already has sufficient funds${colors.reset}`);
        continue;
      }
      
      // Send funds
      const tx = await funder.sendTransaction({
        to: wallet.address,
        value: ethers.parseEther(wallet.amount)
      });
      
      console.log(`  Sending ${wallet.amount} ETH...`);
      console.log(`  Tx: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`  ${colors.green}✓ Confirmed in block ${receipt?.blockNumber}${colors.reset}`);
      
      // Show new balance
      const newBalance = await provider.getBalance(wallet.address);
      console.log(`  New balance: ${ethers.formatEther(newBalance)} ETH\n`);
      
    } catch (error) {
      console.error(`${colors.red}❌ Error funding ${wallet.name}:${colors.reset}`, error);
      process.exit(1);
    }
  }
  
  // Show final funder balance
  const finalBalance = await provider.getBalance(funder.address);
  console.log(`${colors.green}✅ Funding complete!${colors.reset}`);
  console.log(`Funder remaining balance: ${ethers.formatEther(finalBalance)} ETH`);
  
  console.log(`\n${colors.yellow}⚠️  Note: Alice and Bob wallets not funded in minimal mode${colors.reset}`);
  console.log(`The demo script will not work without funding Alice and Bob`);
  console.log(`But you can still deploy contracts!`);
  
  // Save funding record
  const fundingRecord = {
    timestamp: new Date().toISOString(),
    network: 'arbitrum',
    mode: 'minimal',
    funderAddress: funder.address,
    distributions: walletsToFund,
    totalDistributed: totalNeeded,
    remainingBalance: ethers.formatEther(finalBalance)
  };
  
  const recordPath = path.join(__dirname, '..', 'funding-record.json');
  fs.writeFileSync(recordPath, JSON.stringify(fundingRecord, null, 2));
  console.log(`\n${colors.blue}📝 Funding record saved to funding-record.json${colors.reset}`);
}

fundWalletsMinimal().catch(console.error);