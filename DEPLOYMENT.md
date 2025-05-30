# 🚀 Arbitrum Deployment Guide

This guide walks you through deploying the RMSP contracts to Arbitrum mainnet using our automated key management system.

## 📋 Prerequisites

- Node.js 18+
- Foundry installed (`curl -L https://foundry.paradigm.xyz | bash`)
- ~0.05 ETH on Arbitrum (for deployment + testing)

## 🔑 Step 1: Generate Deployment Keys

```bash
npm run setup-keys
```

This will:
- Generate 4 wallets (Deployer, Alice, Bob, Funder)
- Save keys to `.env` and `keys.json`
- Display the FUNDER address for you to fund

**Output example:**
```
🔑 Generating new wallets...

✅ Wallets Generated:

📋 FUNDER (You fund this one):
   Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f5b123
   Private Key: abcd1234...

🚀 DEPLOYER:
   Address: 0x123...

👤 ALICE:
   Address: 0x456...

👤 BOB:
   Address: 0x789...
```

## 💰 Step 2: Fund the Funder Wallet

1. Copy the **FUNDER address** from the output
2. Send **0.05 ETH** to this address on Arbitrum One
   - Use [bridge.arbitrum.io](https://bridge.arbitrum.io) if you need to bridge from Ethereum
   - Or send from any exchange that supports Arbitrum

## 🎯 Step 3: Distribute Funds

Once the funder wallet has ETH, run:

```bash
npm run fund-wallets
```

This will automatically:
- Send 0.02 ETH to Deployer (for contract deployment)
- Send 0.005 ETH to Alice (for testing)
- Send 0.005 ETH to Bob (for testing)
- Keep remaining ETH in funder for gas

## 📦 Step 4: Deploy Contracts

```bash
npm run deploy
```

Or with verification on Arbiscan:

```bash
npm run deploy:verify
```

This will deploy:
- MockUSDC
- RatioOracle
- SimplePerpV2

Deployment addresses will be saved to `contracts/deployments/arbitrum.json`

## 🧪 Step 5: Run Demo (Optional)

Test the deployment with the demo script:

```bash
npm run demo
```

## 💸 Step 6: Return Funds

After testing, recover all remaining ETH:

```bash
npm run return-funds
```

This will:
1. Ask for your address
2. Consolidate all ETH to the funder wallet
3. Send everything back to your address
4. Save a return record

## 📁 File Structure

After deployment, you'll have:

```
├── .env                    # Environment variables (git ignored)
├── keys.json              # Generated wallet details (git ignored)
├── funding-record.json    # Record of fund distribution (git ignored)
├── return-record.json     # Record of fund returns (git ignored)
└── contracts/
    └── deployments/
        └── arbitrum.json  # Deployed contract addresses
```

## 🔒 Security Notes

- **Never commit** `.env`, `keys.json`, or any private keys
- These are testnet keys - generate new ones for production
- Always verify contract source code on Arbiscan
- Test thoroughly on testnet first

## 🛠 Troubleshooting

### "Insufficient funds" error
- Make sure you sent enough ETH to the funder address
- Check that you're on the correct network (Arbitrum One)

### "Cannot estimate gas" error
- The RPC might be congested, try again in a few minutes
- Increase gas limits in the deployment script

### Verification fails
- Make sure you have an Arbiscan API key in `.env`
- Get one at [arbiscan.io/apis](https://arbiscan.io/apis)

## 📊 Gas Estimates

Typical deployment costs on Arbitrum:
- MockUSDC: ~0.002 ETH
- RatioOracle: ~0.003 ETH
- SimplePerpV2: ~0.005 ETH
- Total: ~0.01 ETH + buffer

## 🎯 Next Steps

After deployment:
1. Test the contracts using the demo script
2. Update the oracle with real Pyth price feeds
3. Build and deploy the frontend
4. Set up indexing with Ponder.sh

## 📞 Support

If you encounter issues:
1. Check the [Arbitrum docs](https://docs.arbitrum.io)
2. Verify your RPC connection
3. Ensure all dependencies are installed