#!/bin/bash

source .env

echo "Testing Arbiscan API Key..."
echo "Key: ${ARBISCAN_API_KEY:0:10}..."

# Test the API key with a simple request
RESPONSE=$(curl -s "https://api.arbiscan.io/api?module=account&action=balance&address=0x0000000000000000000000000000000000000000&tag=latest&apikey=$ARBISCAN_API_KEY")

echo "API Response: $RESPONSE"

# Check if we're getting rate limited or invalid key
if [[ $RESPONSE == *"Invalid API Key"* ]]; then
    echo "❌ API Key is invalid"
elif [[ $RESPONSE == *"Max rate limit reached"* ]]; then
    echo "⚠️ Rate limited - API key might be valid but exceeded limits"
elif [[ $RESPONSE == *"result"* ]]; then
    echo "✅ API Key is valid!"
else
    echo "❓ Unexpected response"
fi