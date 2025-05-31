"use client"

import React, { createContext, useContext, ReactNode } from 'react'
import useLivePrices, { LivePriceData } from '@/lib/hooks/useLivePrices'

interface LivePricesContextType {
  prices: LivePriceData[]
  isLoading: boolean
  error: string | null
  isLive: boolean
  lastUpdate: Date | null
  ethPrice: number | null
  btcPrice: number | null
  ethShare: number | null
  btcShare: number | null
}

const LivePricesContext = createContext<LivePricesContextType | undefined>(undefined)

export function LivePricesProvider({ children }: { children: ReactNode }) {
  // Single instance of useLivePrices that all components will share
  const pricesData = useLivePrices(5000) // Poll every 5 seconds

  return (
    <LivePricesContext.Provider value={pricesData}>
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