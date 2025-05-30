#!/bin/bash

source .env

echo "🔍 Direct Arbiscan Verification"
echo "================================"

cd contracts

# Try with explicit compiler settings
echo "1. Verifying MockUSDC..."
forge verify-contract \
    --chain-id 42161 \
    --num-of-optimizations 200 \
    --compiler-version v0.8.19+commit.7dd6d404 \
    --etherscan-api-key "$ARBISCAN_API_KEY" \
    0xe2696990894452AbE9ce45ba557979c2cbc6B3dd \
    MockUSDC \
    --watch

echo ""
echo "2. Verifying RatioOracle..."
forge verify-contract \
    --chain-id 42161 \
    --num-of-optimizations 200 \
    --compiler-version v0.8.19+commit.7dd6d404 \
    --etherscan-api-key "$ARBISCAN_API_KEY" \
    0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f \
    RatioOracle \
    --watch

echo ""
echo "3. Verifying SimplePerpV2..."
# Constructor args for SimplePerpV2
CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address,address)" 0xe2696990894452AbE9ce45ba557979c2cbc6B3dd 0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f)

forge verify-contract \
    --chain-id 42161 \
    --num-of-optimizations 200 \
    --compiler-version v0.8.19+commit.7dd6d404 \
    --constructor-args "$CONSTRUCTOR_ARGS" \
    --etherscan-api-key "$ARBISCAN_API_KEY" \
    0x99d45f0d21D135D0947F641Ae4C10E00DF820244 \
    SimplePerpV2 \
    --watch