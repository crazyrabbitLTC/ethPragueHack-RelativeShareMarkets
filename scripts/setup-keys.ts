import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

interface GeneratedKeys {
  deployer: { address: string; privateKey: string };
  alice: { address: string; privateKey: string };
  bob: { address: string; privateKey: string };
  funder: { address: string; privateKey: string };
}

// Generate new wallets
function generateKeys(): GeneratedKeys {
  console.log(`${colors.blue}🔑 Generating new wallets...${colors.reset}\n`);
  
  const deployer = ethers.Wallet.createRandom();
  const alice = ethers.Wallet.createRandom();
  const bob = ethers.Wallet.createRandom();
  const funder = ethers.Wallet.createRandom();
  
  const keys = {
    deployer: {
      address: deployer.address,
      privateKey: deployer.privateKey.slice(2) // Remove 0x prefix
    },
    alice: {
      address: alice.address,
      privateKey: alice.privateKey.slice(2)
    },
    bob: {
      address: bob.address,
      privateKey: bob.privateKey.slice(2)
    },
    funder: {
      address: funder.address,
      privateKey: funder.privateKey.slice(2)
    }
  };
  
  // Display generated addresses
  console.log(`${colors.green}✅ Wallets Generated:${colors.reset}`);
  console.log(`\n📋 ${colors.yellow}FUNDER${colors.reset} (You fund this one):`);
  console.log(`   Address: ${colors.green}${keys.funder.address}${colors.reset}`);
  console.log(`   Private Key: ${keys.funder.privateKey}`);
  
  console.log(`\n🚀 ${colors.yellow}DEPLOYER${colors.reset}:`);
  console.log(`   Address: ${keys.deployer.address}`);
  
  console.log(`\n👤 ${colors.yellow}ALICE${colors.reset}:`);
  console.log(`   Address: ${keys.alice.address}`);
  
  console.log(`\n👤 ${colors.yellow}BOB${colors.reset}:`);
  console.log(`   Address: ${keys.bob.address}`);
  
  return keys;
}

// Save keys to .env file
function saveKeysToEnv(keys: GeneratedKeys) {
  const envPath = path.join(__dirname, '..', '.env');
  
  // Load existing .env or create new content
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or add keys
  const updates = {
    'PRIVATE_KEY': keys.deployer.privateKey,
    'DEPLOYER_ADDRESS': keys.deployer.address,
    'ALICE_PRIVATE_KEY': keys.alice.privateKey,
    'ALICE_ADDRESS': keys.alice.address,
    'BOB_PRIVATE_KEY': keys.bob.privateKey,
    'BOB_ADDRESS': keys.bob.address,
    'FUNDER_PRIVATE_KEY': keys.funder.privateKey,
    'FUNDER_ADDRESS': keys.funder.address,
  };
  
  // Update existing or append new
  Object.entries(updates).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'gm');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `${key}=${value}\n`;
    }
  });
  
  // Add RPC URL if not present
  if (!envContent.includes('ARBITRUM_RPC_URL')) {
    envContent += '\n# RPC URLs\nARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc\n';
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log(`\n${colors.green}✅ Keys saved to .env file${colors.reset}`);
}

// Save keys to JSON for easy access
function saveKeysToJson(keys: GeneratedKeys) {
  const keysPath = path.join(__dirname, '..', 'keys.json');
  
  const keysData = {
    generated: new Date().toISOString(),
    network: 'arbitrum',
    wallets: keys,
    fundingInstructions: {
      step1: `Send ETH to FUNDER address: ${keys.funder.address}`,
      step2: 'Run: npm run fund-wallets',
      step3: 'Deploy contracts',
      step4: 'Run: npm run return-funds'
    }
  };
  
  fs.writeFileSync(keysPath, JSON.stringify(keysData, null, 2));
  console.log(`${colors.green}✅ Keys saved to keys.json${colors.reset}`);
}

// Main function
async function main() {
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     🔐 Arbitrum Deployment Key Generator${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);
  
  const keys = generateKeys();
  
  saveKeysToEnv(keys);
  saveKeysToJson(keys);
  
  console.log(`\n${colors.yellow}📌 NEXT STEPS:${colors.reset}`);
  console.log(`1. Send ETH to the FUNDER address on Arbitrum:`);
  console.log(`   ${colors.green}${keys.funder.address}${colors.reset}`);
  console.log(`   (Recommended: 0.05 ETH for deployment + testing)`);
  console.log(`\n2. Run: ${colors.blue}npm run fund-wallets${colors.reset}`);
  console.log(`   This will distribute ETH to all wallets`);
  console.log(`\n3. Deploy your contracts`);
  console.log(`\n4. Run: ${colors.blue}npm run return-funds${colors.reset}`);
  console.log(`   This will return all remaining ETH to you`);
  
  console.log(`\n${colors.red}⚠️  IMPORTANT:${colors.reset}`);
  console.log(`- Keep your keys.json file secure and don't commit it!`);
  console.log(`- Add keys.json to .gitignore`);
  console.log(`- These are testnet keys - generate new ones for mainnet`);
}

main().catch(console.error);