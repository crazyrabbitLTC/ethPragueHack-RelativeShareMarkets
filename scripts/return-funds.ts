import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

dotenv.config();

const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function returnFunds() {
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     💸 Return Funds to Original Sender${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);
  
  // Setup provider
  const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc');
  
  // Get all wallets
  const wallets = [
    {
      name: 'Deployer',
      privateKey: process.env.PRIVATE_KEY!,
      address: process.env.DEPLOYER_ADDRESS!
    },
    {
      name: 'Alice',
      privateKey: process.env.ALICE_PRIVATE_KEY!,
      address: process.env.ALICE_ADDRESS!
    },
    {
      name: 'Bob',
      privateKey: process.env.BOB_PRIVATE_KEY!,
      address: process.env.BOB_ADDRESS!
    },
    {
      name: 'Funder',
      privateKey: process.env.FUNDER_PRIVATE_KEY!,
      address: process.env.FUNDER_ADDRESS!
    }
  ];
  
  // Check all balances
  console.log(`${colors.yellow}Current Balances:${colors.reset}`);
  let totalBalance = 0n;
  
  for (const wallet of wallets) {
    const balance = await provider.getBalance(wallet.address);
    console.log(`${wallet.name}: ${ethers.formatEther(balance)} ETH`);
    totalBalance += balance;
  }
  
  console.log(`\n${colors.green}Total ETH across all wallets: ${ethers.formatEther(totalBalance)} ETH${colors.reset}`);
  
  // Ask for return address
  const returnAddress = await askQuestion(`\n${colors.yellow}Enter your address to return funds to: ${colors.reset}`);
  
  // Validate address
  if (!ethers.isAddress(returnAddress)) {
    console.error(`${colors.red}❌ Invalid address!${colors.reset}`);
    rl.close();
    process.exit(1);
  }
  
  // Confirm
  console.log(`\n${colors.yellow}⚠️  This will return all funds to: ${colors.green}${returnAddress}${colors.reset}`);
  const confirm = await askQuestion('Continue? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Cancelled.');
    rl.close();
    process.exit(0);
  }
  
  console.log(`\n${colors.blue}Step 1: Consolidating funds to Funder wallet...${colors.reset}`);
  
  // First, send all funds to funder wallet
  const funder = new ethers.Wallet(`0x${wallets[3].privateKey}`, provider);
  
  for (let i = 0; i < 3; i++) { // Skip funder itself
    const wallet = wallets[i];
    const signer = new ethers.Wallet(`0x${wallet.privateKey}`, provider);
    const balance = await provider.getBalance(wallet.address);
    
    if (balance > 0n) {
      try {
        console.log(`\n${colors.yellow}Returning funds from ${wallet.name}...${colors.reset}`);
        
        // Estimate gas
        const gasPrice = (await provider.getFeeData()).gasPrice!;
        const gasLimit = 21000n; // Standard transfer
        const gasCost = gasPrice * gasLimit;
        
        // Leave a tiny amount for gas
        const amountToSend = balance - gasCost - ethers.parseEther('0.0001');
        
        if (amountToSend > 0n) {
          const tx = await signer.sendTransaction({
            to: funder.address,
            value: amountToSend,
            gasLimit: gasLimit
          });
          
          console.log(`  Sending ${ethers.formatEther(amountToSend)} ETH...`);
          console.log(`  Tx: ${tx.hash}`);
          
          const receipt = await tx.wait();
          console.log(`  ${colors.green}✓ Confirmed${colors.reset}`);
        } else {
          console.log(`  ${colors.yellow}⚠️  Balance too low to transfer${colors.reset}`);
        }
      } catch (error) {
        console.error(`${colors.red}❌ Error returning funds from ${wallet.name}:${colors.reset}`, error);
      }
    }
  }
  
  // Wait a bit for consolidation
  console.log(`\n${colors.blue}Step 2: Returning all funds to your address...${colors.reset}`);
  
  // Get funder's final balance
  const funderFinalBalance = await provider.getBalance(funder.address);
  console.log(`Funder consolidated balance: ${ethers.formatEther(funderFinalBalance)} ETH`);
  
  if (funderFinalBalance > ethers.parseEther('0.001')) {
    try {
      // Estimate gas for final transfer
      const gasPrice = (await provider.getFeeData()).gasPrice!;
      const gasLimit = 21000n;
      const gasCost = gasPrice * gasLimit;
      
      const finalAmount = funderFinalBalance - gasCost - ethers.parseEther('0.0001');
      
      const finalTx = await funder.sendTransaction({
        to: returnAddress,
        value: finalAmount,
        gasLimit: gasLimit
      });
      
      console.log(`\n${colors.yellow}Sending final amount to your address...${colors.reset}`);
      console.log(`Amount: ${ethers.formatEther(finalAmount)} ETH`);
      console.log(`Tx: ${finalTx.hash}`);
      
      const finalReceipt = await finalTx.wait();
      console.log(`${colors.green}✓ Confirmed in block ${finalReceipt?.blockNumber}${colors.reset}`);
      
      // Save return record
      const returnRecord = {
        timestamp: new Date().toISOString(),
        network: 'arbitrum',
        returnAddress: returnAddress,
        totalReturned: ethers.formatEther(finalAmount),
        transactionHash: finalTx.hash,
        blockNumber: finalReceipt?.blockNumber
      };
      
      const recordPath = path.join(__dirname, '..', 'return-record.json');
      fs.writeFileSync(recordPath, JSON.stringify(returnRecord, null, 2));
      
      console.log(`\n${colors.green}✅ All funds returned successfully!${colors.reset}`);
      console.log(`Total returned: ${ethers.formatEther(finalAmount)} ETH`);
      console.log(`Return record saved to return-record.json`);
      
    } catch (error) {
      console.error(`${colors.red}❌ Error in final transfer:${colors.reset}`, error);
    }
  }
  
  // Show final balances
  console.log(`\n${colors.yellow}Final Balances:${colors.reset}`);
  for (const wallet of wallets) {
    const balance = await provider.getBalance(wallet.address);
    console.log(`${wallet.name}: ${ethers.formatEther(balance)} ETH`);
  }
  
  rl.close();
}

returnFunds().catch((error) => {
  console.error(error);
  rl.close();
  process.exit(1);
});