"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useLivePricesContext } from "@/lib/contexts/LivePricesContext"
import { useEffect, useState } from "react"
import { useDebouncedState } from "@/lib/hooks/useDebouncedState"

export interface Token {
  symbol: string
  weight: number
  currentShare: number
  change24h?: number
  volatility?: number
  price?: number
}

interface ShareTableProps {
  tokens: Token[]
  useLiveData?: boolean
}

export function ShareTable({ tokens, useLiveData = true }: ShareTableProps) {
  const { prices, isLoading, isLive, error } = useLivePricesContext()
  const [enhancedTokens, setEnhancedTokens] = useState<Token[]>(tokens)
  
  // Debounce the live status to prevent flickering
  const [debouncedIsLive] = useDebouncedState(isLive, 1000)
  const [debouncedError] = useDebouncedState(error, 1000)

  // Update tokens with live price data
  useEffect(() => {
    if (useLiveData && prices.length > 0) {
      const updatedTokens = tokens.map(token => {
        const liveData = prices.find(p => p.symbol === token.symbol)
        if (liveData) {
          return {
            ...token,
            currentShare: liveData.share,
            change24h: liveData.change24h || token.change24h,
            price: liveData.price
          }
        }
        return token
      })
      setEnhancedTokens(updatedTokens)
    } else {
      setEnhancedTokens(tokens)
    }
  }, [prices, tokens, useLiveData])

  const formatPrice = (price: number | undefined, symbol: string) => {
    if (!price) return 'N/A'
    
    if (symbol === 'BTC' && price > 1000) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="bg-gray-900/30 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Asset Share Breakdown</h3>
          {useLiveData && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-red-500'} ${isLive ? 'animate-pulse' : ''}`}></div>
              <Badge 
                variant={isLive ? "default" : "secondary"} 
                className={`text-xs ${isLive ? 'bg-green-600' : 'bg-gray-600'}`}
              >
                {isLoading ? 'Loading...' : isLive ? 'LIVE' : 'DEMO'}
              </Badge>
            </div>
          )}
        </div>
        {!isLoading && error && !isLive && (
          <p className="text-xs text-yellow-400 mt-1">
            Using demo data (API unavailable)
          </p>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-gray-800 hover:bg-gray-800/30">
            <TableHead className="text-gray-300">Token</TableHead>
            <TableHead className="text-gray-300">Price</TableHead>
            <TableHead className="text-gray-300">Current Share</TableHead>
            <TableHead className="text-gray-300">Target Weight</TableHead>
            <TableHead className="text-gray-300">24h Δ</TableHead>
            <TableHead className="text-gray-300">Volatility (30d)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {enhancedTokens.map((token) => {
            const isStaleData = !useLiveData || (!debouncedIsLive && !isLoading)
            
            return (
              <TableRow key={token.symbol} className="border-gray-800 hover:bg-gray-800/20 transition-colors">
                <TableCell className="font-semibold">
                  <div className="flex items-center gap-2">
                    {token.symbol}
                    {isStaleData && (
                      <Badge variant="outline" className="text-xs text-gray-400">
                        DEMO
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                <TableCell className="font-medium text-blue-400">
                  {formatPrice(token.price, token.symbol)}
                </TableCell>
                
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {(token.currentShare ?? 0).toFixed(useLiveData && debouncedIsLive ? 4 : 1)}%
                    </span>
                    {useLiveData && debouncedIsLive && (
                      <Badge variant="outline" className="text-xs text-green-400">
                        LIVE
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                <TableCell className="text-gray-300">
                  {token.weight}%
                </TableCell>
                
                <TableCell className={`font-medium ${(token.change24h ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {(token.change24h ?? 0) >= 0 ? "+" : ""}
                  {(token.change24h ?? 0).toFixed(2)}%
                </TableCell>
                
                <TableCell className="text-gray-300">
                  {(token.volatility ?? 0).toFixed(1)}%
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      
      {useLiveData && (
        <div className="p-3 border-t border-gray-800 bg-gray-900/20">
          <p className="text-xs text-gray-400 text-center">
            {debouncedIsLive 
              ? `🔴 Live data from Pyth Network • Updates every 5 seconds`
              : `📊 Demo data • ${debouncedError ? 'API unavailable' : 'Real-time updates paused'}`
            }
          </p>
        </div>
      )}
    </div>
  )
}
