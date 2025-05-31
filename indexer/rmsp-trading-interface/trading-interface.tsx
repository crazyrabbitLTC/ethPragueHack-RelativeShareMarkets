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
import { useLatestPrices } from "./lib/hooks/usePrices"
import { useAllPositions, transformPositionForUI } from "./lib/hooks/usePositions"
// import { useToasts } from "./hooks/useToasts"; // If toasts are managed globally or triggered here

export default function TradingInterface() {
  const [isConnected, setIsConnected] = useState(true)
  
  // Fetch real block number from indexer
  const { latestBlockNumber } = useLatestPrices(1, 5000); // Poll every 5 seconds
  const displayBlockNumber = latestBlockNumber || 18234567; // Fallback to default

  // Fetch real positions data
  const { positions, stats } = useAllPositions(10);
  
  // Use the first open position for display, or mock data if none
  const firstOpenPosition = positions.find(p => p.status === 'open');
  const displayPosition = firstOpenPosition 
    ? transformPositionForUI(firstOpenPosition)
    : mockPositionData;

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
      <HeaderBar 
        blockNumber={displayBlockNumber} 
        isConnected={isConnected} 
        onConnect={() => setIsConnected(!isConnected)} 
      />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <TradingPairSelector />
          <div className="w-full md:w-auto">
            <BasketChips
              baseToken="ETH"
              tokens={mockTokensData}
              totalPnl={stats?.totalPnl || mockPositionData.pnlUsd}
              totalPnlPercent={stats?.totalPnlPercent || mockPositionData.pnlPercent}
            />
          </div>
        </div>

        <ChartPlaceholder baseToken="ETH" currentShare={displayPosition.currentShare} />

        <ShareTable tokens={mockTokensData} />

        <div className="grid lg:grid-cols-2 gap-6">
          <OrderForm
            baseToken="ETH"
            basketTokens={mockTokensData}
            // onSubmitSuccess={handleOrderSuccess} // Pass callback
          />
          <PositionCard
            initialPosition={displayPosition}
            // onAddCollateralApi={async (amount) => console.log("API: Add collateral", amount)}
          />
        </div>
      </main>

      <ToastStack />
    </div>
  )
}
