"use client"

import React, { createContext, useContext, ReactNode } from 'react'
import useLivePrices, { LivePriceData } from '@/lib/hooks/useLivePrices'

interface LivePricesContextValue {
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

const LivePricesContext = createContext<LivePricesContextValue | undefined>(undefined)

export function LivePricesProvider({ children }: { children: ReactNode }) {
  // Single instance of useLivePrices that will be shared across all components
  const livePricesData = useLivePrices(5000) // Poll every 5 seconds

  return (
    <LivePricesContext.Provider value={livePricesData}>
      {children}
    </LivePricesContext.Provider>
  )
}

export function useLivePricesContext() {
  const context = useContext(LivePricesContext)
  if (context === undefined) {
    throw new Error('useLivePricesContext must be used within a LivePricesProvider')
  }
  return context
}