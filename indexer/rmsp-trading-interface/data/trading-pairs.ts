export interface TradingPair {
  id: string
  base: string
  quoteDescription: string
  fullLabel: string
}

export const placeholderTradingPairs: TradingPair[] = [
  { id: "eth-basket", base: "ETH", quoteDescription: "Basket", fullLabel: "ETH vs Basket" },
  { id: "sol-btc", base: "SOL", quoteDescription: "BTC", fullLabel: "SOL vs BTC" },
  { id: "arb-eth", base: "ARB", quoteDescription: "ETH", fullLabel: "ARB vs ETH" },
  { id: "link-basket", base: "LINK", quoteDescription: "Basket", fullLabel: "LINK vs Basket" },
  { id: "matic-usdc", base: "MATIC", quoteDescription: "USDC", fullLabel: "MATIC vs USDC" },
]
