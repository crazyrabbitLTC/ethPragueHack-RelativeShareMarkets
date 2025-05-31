"use client"

interface Token {
  symbol: string
  weight: number
  currentShare: number
}

interface BasketChipsProps {
  baseToken: string
  tokens: Token[]
  totalPnl: number
  totalPnlPercent: number
}

export function BasketChips({ baseToken, tokens, totalPnl, totalPnlPercent }: BasketChipsProps) {
  const hasPositions = totalPnl !== 0 || totalPnlPercent !== 0
  const isPositive = totalPnl >= 0

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-900/30 rounded-xl border border-gray-800">
      {/* Basket Tokens */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-400 font-medium">Basket:</span>
        {tokens.map((token) => (
          <div
            key={token.symbol}
            className="flex items-center space-x-2 bg-gray-800/50 rounded-lg px-3 py-1.5 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
          >
            <span className="font-semibold text-sm">{token.symbol}</span>
            <span className="text-xs text-gray-400">{token.currentShare.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      {/* PnL Ticker */}
      <div
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
          hasPositions
            ? isPositive
              ? "bg-green-900/20 border-green-500/30 text-green-400"
              : "bg-red-900/20 border-red-500/30 text-red-400"
            : "bg-gray-900/20 border-gray-700/30 text-gray-500"
        }`}
      >
        <span className="text-sm font-medium">PnL:</span>
        <span className="font-bold">
          {hasPositions ? (
            <>
              {isPositive ? "+" : ""}${totalPnl.toLocaleString()} ({isPositive ? "+" : ""}
              {totalPnlPercent.toFixed(2)}%)
            </>
          ) : (
            "No positions"
          )}
        </span>
      </div>
    </div>
  )
}
