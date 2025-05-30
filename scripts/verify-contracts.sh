#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Verifying Contracts on Arbiscan${NC}"
echo "====================================="

# Check if deployment file exists
if [ ! -f "contracts/deployments/arbitrum.json" ]; then
    echo -e "${RED}❌ No deployment file found!${NC}"
    echo "Run 'npm run deploy' first"
    exit 1
fi

# Read addresses from deployment file
USDC_ADDR=$(cat contracts/deployments/arbitrum.json | grep -o '"MockUSDC": "[^"]*"' | cut -d'"' -f4)
ORACLE_ADDR=$(cat contracts/deployments/arbitrum.json | grep -o '"RatioOracle": "[^"]*"' | cut -d'"' -f4)
PERP_ADDR=$(cat contracts/deployments/arbitrum.json | grep -o '"SimplePerpV2": "[^"]*"' | cut -d'"' -f4)

echo "Found deployed contracts:"
echo "MockUSDC: $USDC_ADDR"
echo "RatioOracle: $ORACLE_ADDR"
echo "SimplePerpV2: $PERP_ADDR"
echo ""

# Check for API key
if [ -z "$ARBISCAN_API_KEY" ]; then
    echo -e "${RED}❌ ARBISCAN_API_KEY not set!${NC}"
    echo "Add it to your .env file"
    exit 1
fi

cd contracts

# Verify MockUSDC
echo -e "${YELLOW}Verifying MockUSDC...${NC}"
forge verify-contract \
    --chain-id 42161 \
    --etherscan-api-key $ARBISCAN_API_KEY \
    --watch \
    $USDC_ADDR \
    src/mocks/MockUSDC.sol:MockUSDC

echo ""

# Verify RatioOracle
echo -e "${YELLOW}Verifying RatioOracle...${NC}"
forge verify-contract \
    --chain-id 42161 \
    --etherscan-api-key $ARBISCAN_API_KEY \
    --watch \
    $ORACLE_ADDR \
    src/RatioOracle.sol:RatioOracle

echo ""

# Verify SimplePerpV2 (with constructor args)
echo -e "${YELLOW}Verifying SimplePerpV2...${NC}"
# Encode constructor arguments
CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address,address)" $USDC_ADDR $ORACLE_ADDR)

forge verify-contract \
    --chain-id 42161 \
    --etherscan-api-key $ARBISCAN_API_KEY \
    --constructor-args $CONSTRUCTOR_ARGS \
    --watch \
    $PERP_ADDR \
    src/SimplePerpV2.sol:SimplePerpV2

echo ""
echo -e "${GREEN}✅ Verification complete!${NC}"
echo "Check the contracts on Arbiscan:"
echo "https://arbiscan.io/address/$USDC_ADDR"
echo "https://arbiscan.io/address/$ORACLE_ADDR"
echo "https://arbiscan.io/address/$PERP_ADDR"