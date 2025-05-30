import type { Token } from "@/components/share-table" // Assuming Token type is exported or defined globally
import type { Position } from "@/components/position-card" // Assuming Position type is exported or defined globally

export const mockTokensData: Token[] = [
  { symbol: "BTC", weight: 40, currentShare: 42.3, change24h: -1.2, volatility: 3.8 },
  { symbol: "SOL", weight: 30, currentShare: 28.7, change24h: 2.4, volatility: 8.2 },
  { symbol: "ARB", weight: 30, currentShare: 29.0, change24h: 0.8, volatility: 12.1 },
]

export const mockPositionData: Position = {
  side: "long",
  entryShare: 38.2,
  currentShare: 41.5,
  pnlUsd: 1254,
  pnlPercent: 8.12,
  margin: 2500,
  liquidationDistance: 6.2,
  notional: 15000,
}
