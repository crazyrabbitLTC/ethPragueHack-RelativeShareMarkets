"use client"

import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLivePricesContext } from '@/lib/contexts/LivePricesContext'
import { LivePriceData } from '@/lib/hooks/useLivePrices'
import { useDebouncedState } from '@/lib/hooks/useDebouncedState'

export interface LivePrice {
  symbol: string
  price: number
  confidence: number
  publishTime: number
  share: number
  change24h?: number
}

interface LivePriceDisplayProps {
  onPriceUpdate?: (prices: LivePrice[]) => void
  className?: string
}

export function LivePriceDisplay({ onPriceUpdate, className }: LivePriceDisplayProps) {
  // Use the shared context to avoid competing requests
  const { prices, isLoading, error, isLive, lastUpdate } = useLivePricesContext()
  
  // Debounce the live status to prevent flickering
  const [debouncedIsLive] = useDebouncedState(isLive, 1000)
  const [debouncedError] = useDebouncedState(error, 1000)

  // Convert LivePriceData to LivePrice format and notify parent
  useEffect(() => {
    if (prices.length > 0 && onPriceUpdate) {
      const convertedPrices: LivePrice[] = prices.map(p => ({
        symbol: p.symbol,
        price: p.price,
        confidence: p.confidence,
        publishTime: p.publishTime,
        share: p.share,
        change24h: p.change24h
      }))
      onPriceUpdate(convertedPrices)
    }
  }, [prices, onPriceUpdate])

  const formatPrice = (price: number, symbol: string) => {
    if (symbol === 'BTC' && price > 1000) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString()
  }

  const getAgeSeconds = (publishTime: number) => {
    return Math.floor(Date.now() / 1000 - publishTime)
  }

  if (isLoading) {
    return (
      <Card className={`bg-gray-900/30 border-gray-800 ${className}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            Live Market Prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="inline-flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Fetching live prices...
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`bg-gray-900/30 border-gray-800 ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${debouncedIsLive ? 'bg-green-500' : 'bg-red-500'} ${debouncedIsLive ? 'animate-pulse' : ''}`}></div>
          Live Market Prices
          {!isLoading && debouncedError && (
            <Badge variant="destructive" className="ml-2 text-xs">
              {debouncedIsLive ? 'Using Fallback' : 'Offline'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {prices.map((priceData) => {
          const ageSeconds = getAgeSeconds(priceData.publishTime)
          const isStale = ageSeconds > 60 // Consider stale if > 1 minute old
          
          return (
            <div key={priceData.symbol} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="font-semibold text-lg">{priceData.symbol}</span>
                  <span className="text-xs text-gray-400">
                    {formatTimestamp(priceData.publishTime)}
                    {isStale && (
                      <span className="text-yellow-400 ml-1">
                        ({ageSeconds}s old)
                      </span>
                    )}
                  </span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xl">
                    {formatPrice(priceData.price, priceData.symbol)}
                  </span>
                  {priceData.change24h !== undefined && (
                    <Badge 
                      variant={priceData.change24h >= 0 ? "default" : "destructive"}
                      className={`text-xs ${priceData.change24h >= 0 ? 'bg-green-600' : 'bg-red-600'}`}
                    >
                      {priceData.change24h >= 0 ? '+' : ''}{priceData.change24h.toFixed(2)}%
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-medium">
                    {priceData.share.toFixed(2)}% share
                  </span>
                  {priceData.confidence > 0 && (
                    <span className="text-xs text-gray-400">
                      ±${priceData.confidence.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        
        {lastUpdate && (
          <div className="text-center pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-400">
              {debouncedIsLive ? '🔴 LIVE' : '📊 DEMO'} • Last updated: {lastUpdate.toLocaleTimeString()}
              {debouncedError && !debouncedIsLive && (
                <span className="text-yellow-400 ml-2">
                  (API unavailable, using fallback data)
                </span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}