#!/bin/bash

echo "🚀 Activating Pyth Oracle for REAL hackathon testing..."
echo ""

# Run the activate-pyth script
npx ts-node scripts/activate-pyth.ts

echo ""
echo "✅ Pyth activation attempted!"
echo ""
echo "If successful, you'll need to update prices before trading:"
echo "  npm run update-prices"
echo ""
echo "Or use the 'Update Oracle Prices' button in the UI!"