"use client"

import { useState, useEffect } from "react"
import { HeaderBar } from "./components/header-bar"
import { BasketChips } from "./components/basket-chips"
import { ChartPlaceholder } from "./components/chart-placeholder"
import { ShareTable } from "./components/share-table" // Ensure Token is exported
import { OrderForm } from "./components/order-form"
import { PositionCard, type Position } from "./components/position-card" // Ensure Position is exported
import { ToastStack } from "./components/toast-stack"
import { TradingPairSelector } from "./components/trading-pair-selector"
import { mockTokensData, mockPositionData } from "./data/mock-data"
// import { useToasts } from "./hooks/useToasts"; // If toasts are managed globally or triggered here

export default function TradingInterface() {
  const [blockNumber, setBlockNumber] = useState(18234567)
  const [isConnected, setIsConnected] = useState(true)

  // Position state is now managed by usePositionManagement
  // const { addToast } = useToasts(); // Example if you want to trigger toasts from here

  // Simulate block updates
  useEffect(() => {
    const interval = setInterval(() => {
      setBlockNumber((prev) => prev + 1)
    }, 12000)
    return () => clearInterval(interval)
  }, [])

  // Example of how OrderForm might interact with PositionCard after a successful order
  // This would typically involve a shared state/context or a callback system
  const handleOrderSuccess = (newPosition: Position) => {
    // This is a placeholder. In a real app, you'd update the position
    // through a shared state manager or by refetching data.
    // For now, we'll assume usePositionManagement hook handles its own state or gets updated.
    console.log("Order successful, new position:", newPosition)
    // addToast("Order placed successfully!", "success");
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <HeaderBar blockNumber={blockNumber} isConnected={isConnected} onConnect={() => setIsConnected(!isConnected)} />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <TradingPairSelector />
          <div className="w-full md:w-auto">
            <BasketChips
              baseToken="ETH"
              tokens={mockTokensData}
              totalPnl={mockPositionData.pnlUsd} // This might come from position state
              totalPnlPercent={mockPositionData.pnlPercent} // This might come from position state
            />
          </div>
        </div>

        <ChartPlaceholder baseToken="ETH" currentShare={mockPositionData.currentShare} />

        <ShareTable tokens={mockTokensData} />

        <div className="grid lg:grid-cols-2 gap-6">
          <OrderForm
            baseToken="ETH"
            basketTokens={mockTokensData}
            // onSubmitSuccess={handleOrderSuccess} // Pass callback
          />
          <PositionCard
            initialPosition={mockPositionData}
            // onAddCollateralApi={async (amount) => console.log("API: Add collateral", amount)}
          />
        </div>
      </main>

      <ToastStack />
    </div>
  )
}
