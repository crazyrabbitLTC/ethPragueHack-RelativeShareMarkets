// Realistic price configuration for hackathon demo
// Use these values in your frontend instead of calling the oracle

const REALISTIC_DEMO_PRICES = {
  ETH: 3500,    // $3,500
  BTC: 95000,   // $95,000
  SOL: 200,     // $200 (for future multi-token demo)
  ARB: 1.2,     // $1.20
  AVAX: 35      // $35
};

// Calculate realistic ratios
function calculateRatios(prices = REALISTIC_DEMO_PRICES) {
  const ethPrice = prices.ETH;
  const btcPrice = prices.BTC;
  const totalValue = ethPrice + btcPrice;
  
  const ethShare = ethPrice / totalValue;
  const btcShare = btcPrice / totalValue;
  
  return {
    ETH: {
      price: ethPrice,
      share: ethShare,
      percentage: (ethShare * 100).toFixed(2)
    },
    BTC: {
      price: btcPrice,  
      share: btcShare,
      percentage: (btcShare * 100).toFixed(2)
    }
  };
}

// Export for use in your frontend
const DEMO_RATIOS = calculateRatios();

console.log("📊 Demo Price Ratios:");
console.log("ETH:", DEMO_RATIOS.ETH.percentage + "%");
console.log("BTC:", DEMO_RATIOS.BTC.percentage + "%");

// For React/Next.js frontend:
export { REALISTIC_DEMO_PRICES, DEMO_RATIOS, calculateRatios };

// For vanilla JS:
// window.REALISTIC_DEMO_PRICES = REALISTIC_DEMO_PRICES;
// window.DEMO_RATIOS = DEMO_RATIOS;