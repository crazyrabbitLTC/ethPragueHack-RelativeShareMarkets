#!/bin/bash

# Load environment
source .env

echo "🔍 Manual Contract Verification on Arbiscan"
echo "=========================================="

cd contracts

# Verify MockUSDC
echo "Verifying MockUSDC..."
forge verify-contract \
    0xe2696990894452AbE9ce45ba557979c2cbc6B3dd \
    src/mocks/MockUSDC.sol:MockUSDC \
    --chain arbitrum \
    --etherscan-api-key $ARBISCAN_API_KEY \
    --watch

echo ""

# Verify RatioOracle
echo "Verifying RatioOracle..."
forge verify-contract \
    0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f \
    src/RatioOracle.sol:RatioOracle \
    --chain arbitrum \
    --etherscan-api-key $ARBISCAN_API_KEY \
    --watch

echo ""

# Verify SimplePerpV2
echo "Verifying SimplePerpV2..."
CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address,address)" 0xe2696990894452AbE9ce45ba557979c2cbc6B3dd 0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f)

forge verify-contract \
    0x99d45f0d21D135D0947F641Ae4C10E00DF820244 \
    src/SimplePerpV2.sol:SimplePerpV2 \
    --chain arbitrum \
    --constructor-args $CONSTRUCTOR_ARGS \
    --etherscan-api-key $ARBISCAN_API_KEY \
    --watch

echo ""
echo "✅ Verification requests submitted!"
echo ""
echo "View contracts on Arbiscan:"
echo "MockUSDC: https://arbiscan.io/address/0xe2696990894452AbE9ce45ba557979c2cbc6B3dd"
echo "RatioOracle: https://arbiscan.io/address/0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f"
echo "SimplePerpV2: https://arbiscan.io/address/0x99d45f0d21D135D0947F641Ae4C10E00DF820244"