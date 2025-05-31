import { useState, useEffect, useCallback } from 'react'

export interface LivePriceData {
  symbol: string
  price: number
  confidence: number
  publishTime: number
  share: number
  change24h?: number
  priceChangePercent?: number
}

interface UseLivePricesReturn {
  prices: LivePriceData[]
  isLoading: boolean
  error: string | null
  isLive: boolean
  lastUpdate: Date | null
  refetch: () => Promise<void>
  ethPrice: number | null
  btcPrice: number | null
  ethShare: number | null
  btcShare: number | null
}

// Pyth price feed IDs for Arbitrum
const PRICE_FEED_IDS = {
  ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
}

export function useLivePrices(pollInterval: number = 5000): UseLivePricesReturn {
  const [prices, setPrices] = useState<LivePriceData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchLivePrices = useCallback(async () => {
    const startTime = Date.now()
    
    try {
      setError(null)
      
      // Fetch from Pyth Hermes API
      const priceIds = [PRICE_FEED_IDS.ETH, PRICE_FEED_IDS.BTC]
      const response = await fetch(
        `https://hermes.pyth.network/api/latest_price_feeds?` +
        priceIds.map(id => `ids[]=${id}`).join('&'),
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          mode: 'cors',
          credentials: 'omit',
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data && Array.isArray(data) && data.length >= 2) {
        // Parse ETH and BTC prices
        const ethData = data.find(item => item.id === PRICE_FEED_IDS.ETH)
        const btcData = data.find(item => item.id === PRICE_FEED_IDS.BTC)

        if (ethData?.price && btcData?.price) {
          // Convert from Pyth format
          const ethPrice = Number(ethData.price.price) * Math.pow(10, ethData.price.expo)
          const btcPrice = Number(btcData.price.price) * Math.pow(10, btcData.price.expo)
          
          // Calculate relative shares
          const totalValue = ethPrice + btcPrice
          const ethShare = totalValue > 0 ? (ethPrice / totalValue) * 100 : 0
          const btcShare = totalValue > 0 ? (btcPrice / totalValue) * 100 : 0

          const newPrices: LivePriceData[] = [
            {
              symbol: 'ETH',
              price: ethPrice,
              confidence: Number(ethData.price.conf) * Math.pow(10, ethData.price.expo),
              publishTime: ethData.price.publish_time,
              share: ethShare,
              change24h: 0, // Could implement historical comparison
              priceChangePercent: 0
            },
            {
              symbol: 'BTC',
              price: btcPrice,
              confidence: Number(btcData.price.conf) * Math.pow(10, btcData.price.expo),
              publishTime: btcData.price.publish_time,
              share: btcShare,
              change24h: 0, // Could implement historical comparison
              priceChangePercent: 0
            }
          ]

          setPrices(newPrices)
          setLastUpdate(new Date())
          setIsLive(true)
          
          console.log('📊 Live prices fetched successfully:', {
            ETH: `$${ethPrice.toFixed(2)} (${ethShare.toFixed(4)}%)`,
            BTC: `$${btcPrice.toFixed(2)} (${btcShare.toFixed(4)}%)`,
            timestamp: new Date().toISOString()
          })
        } else {
          throw new Error('Invalid price data structure')
        }
      } else {
        throw new Error('No price data received from Pyth API')
      }
    } catch (fetchError: any) {
      const timestamp = new Date().toISOString()
      console.warn(`[${timestamp}] Pyth API fetch failed:`, fetchError.message)
      setError(fetchError.message)
      
      // Set offline status on any error
      setIsLive(false)
      
      // Use realistic demo data when API is unavailable
      const demoPrices: LivePriceData[] = [
        {
          symbol: 'ETH',
          price: 2542.47,
          confidence: 1.25,
          publishTime: Date.now() / 1000,
          share: 2.37,
          change24h: 1.23,
          priceChangePercent: 1.23
        },
        {
          symbol: 'BTC',
          price: 104710.62,
          confidence: 52.35,
          publishTime: Date.now() / 1000,
          share: 97.63,
          change24h: -0.45,
          priceChangePercent: -0.45
        }
      ]
      
      setPrices(demoPrices)
      setLastUpdate(new Date())
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial fetch
    fetchLivePrices()

    // Set up polling if interval is provided
    if (pollInterval > 0) {
      const interval = setInterval(fetchLivePrices, pollInterval)
      return () => clearInterval(interval)
    }
  }, [fetchLivePrices, pollInterval])

  // Helper getters for individual values
  const ethPrice = prices.find(p => p.symbol === 'ETH')?.price || null
  const btcPrice = prices.find(p => p.symbol === 'BTC')?.price || null
  const ethShare = prices.find(p => p.symbol === 'ETH')?.share || null
  const btcShare = prices.find(p => p.symbol === 'BTC')?.share || null

  return {
    prices,
    isLoading,
    error,
    isLive,
    lastUpdate,
    refetch: fetchLivePrices,
    ethPrice,
    btcPrice,
    ethShare,
    btcShare
  }
}

// Additional hook for just price display without polling
export function useLivePricesOnce() {
  return useLivePrices(0) // No polling
}

// Hook for getting price updates with callback
export function useLivePricesWithCallback(
  onPriceUpdate: (prices: LivePriceData[]) => void,
  pollInterval: number = 5000
) {
  const result = useLivePrices(pollInterval)
  
  useEffect(() => {
    if (result.prices.length > 0) {
      onPriceUpdate(result.prices)
    }
  }, [result.prices, onPriceUpdate])
  
  return result
}

export default useLivePrices