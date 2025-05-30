#!/bin/bash

# Load environment variables
source .env

# Set RPC URL if not already set
if [ -z "$ARBITRUM_RPC_URL" ]; then
    export ARBITRUM_RPC_URL="https://arb1.arbitrum.io/rpc"
fi

echo "🚀 Deploying to Arbitrum One"
echo "================================"
echo "RPC URL: $ARBITRUM_RPC_URL"
echo "Deployer: $DEPLOYER_ADDRESS"
echo "================================"

cd contracts

# Deploy with verification
forge script script/DeploySimple.s.sol \
    --rpc-url $ARBITRUM_RPC_URL \
    --private-key 0x$PRIVATE_KEY \
    --broadcast \
    --verify \
    --etherscan-api-key $ARBISCAN_API_KEY \
    --slow \
    -vvv

echo "✅ Deployment complete!"