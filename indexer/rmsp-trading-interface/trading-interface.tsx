"use client"

import { useState, useEffect, useMemo } from "react"
import { HeaderBar } from "./components/header-bar"
import { BasketChips } from "./components/basket-chips"
import { ShareTable } from "./components/share-table"
import { OrderForm } from "./components/order-form"
import { PositionCard, type Position as PositionType } from "./components/position-card"
import { ToastStack } from "./components/toast-stack"
import { TradingPairSelector } from "./components/trading-pair-selector"
import { RelativeSharesChart } from "./components/chart/RelativeSharesChart"
import { LivePriceDisplay } from "./components/live-price-display"
import { mockTokensData, mockPositionData } from "./data/mock-data"
import { useLatestPrices } from "./lib/hooks/usePrices"
import { useAllPositions, transformPositionForUI } from "./lib/hooks/usePositions"
import { useRelativeSharesChartData } from "./lib/hooks/useRelativeSharesChartData"
// import { useToasts } from "./hooks/useToasts"; // If toasts are managed globally or triggered here

export default function TradingInterface() {
  const [isConnected, setIsConnected] = useState(true)
  const [showAsAreaChart, setShowAsAreaChart] = useState(false)
  const [useMockData, setUseMockData] = useState(false) // Switch to real data by default
  
  // Fetch real block number from indexer
  const { latestBlockNumber } = useLatestPrices(1, 5000); // Poll every 5 seconds
  const displayBlockNumber = latestBlockNumber || 18234567; // Fallback to default

  // Fetch real positions data
  const { positions, stats: positionStats, loading: positionsLoading, error: positionsError } = useAllPositions(10);
  
  // Use real tokens from the indexer (ETH/BTC for SimplePerpV2) - memoized to prevent re-renders
  const realTokensData = useMemo(() => [
    { 
      symbol: 'ETH', 
      currentShare: 50, 
      weight: 50,
      change24h: 0,
      volatility: 15.2
    },
    { 
      symbol: 'BTC', 
      currentShare: 50, 
      weight: 50,
      change24h: 0,
      volatility: 12.8
    },
  ], []);
  
  // Memoize the tokens selection to prevent unnecessary re-renders
  const selectedTokens = useMemo(() => 
    useMockData ? mockTokensData : realTokensData,
    [useMockData, realTokensData]
  );
  
  // Get chart data - real data by default, with fallback to mock
  const { chartData, loading: chartLoading, error: chartError } = useRelativeSharesChartData(
    selectedTokens,
    useMockData
  );
  
  // Use the first open position for display, or mock data if none
  const firstOpenPosition = positions.find(p => p.status === 'open');
  const displayPosition = firstOpenPosition 
    ? transformPositionForUI(firstOpenPosition)
    : mockPositionData;

  // Example of how OrderForm might interact with PositionCard after a successful order
  // This would typically involve a shared state/context or a callback system
  const handleOrderSuccess = (newPosition: PositionType) => {
    // This is a placeholder. In a real app, you'd update the position
    // through a shared state manager or by refetching data.
    // For now, we'll assume usePositionManagement hook handles its own state or gets updated.
    console.log("Order successful, new position:", newPosition)
    // addToast("Order placed successfully!", "success");
  }

  // Show connection status and data source
  const dataStatus = useMockData ? 'Mock Data' : 'Live Data';
  const hasErrors = chartError || positionsError;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <HeaderBar 
        blockNumber={displayBlockNumber} 
        isConnected={isConnected} 
        onConnect={() => setIsConnected(!isConnected)} 
      />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Data source toggle and status */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${hasErrors ? 'bg-red-500' : 'bg-green-500'}`}></div>
              <span className="text-sm text-gray-400">{dataStatus}</span>
            </div>
            {hasErrors && (
              <span className="text-xs text-red-400">
                {chartError?.message || positionsError?.message}
              </span>
            )}
          </div>
          
          <button
            onClick={() => setUseMockData(!useMockData)}
            className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
          >
            Switch to {useMockData ? 'Live' : 'Mock'} Data
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <TradingPairSelector />
          <div className="w-full md:w-auto">
            <BasketChips
              baseToken="ETH"
              tokens={selectedTokens}
              totalPnl={positionStats?.totalPnl || mockPositionData.pnlUsd}
              totalPnlPercent={positionStats?.totalPnlPercent || mockPositionData.pnlPercent}
            />
          </div>
        </div>

        {/* Live Price Display */}
        <LivePriceDisplay className="w-full" />

        {/* Loading states */}
        {(chartLoading || positionsLoading) && (
          <div className="text-center py-10">
            <div className="inline-flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Loading {chartLoading ? 'chart' : 'position'} data...
            </div>
          </div>
        )}
        
        {/* Chart and Share Table in two columns */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Chart column */}
          <div>
            {!chartLoading && !chartError && chartData.length > 0 && (
              <div className="space-y-2">
                {/* Chart type toggle */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowAsAreaChart(!showAsAreaChart)}
                    className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
                  >
                    {showAsAreaChart ? 'Show Lines' : 'Show Area'}
                  </button>
                </div>
                <RelativeSharesChart 
                  data={chartData}
                  height={300}
                  showAsArea={showAsAreaChart}
                />
              </div>
            )}
            
            {/* Fallback if chart data is empty and not loading/erroring */}
            {!chartLoading && !chartError && chartData.length === 0 && !useMockData && (
              <div className="relative w-full h-[300px] bg-gray-900/30 rounded-xl border border-gray-800 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-500 mb-2">No chart data available from indexer.</p>
                  <button
                    onClick={() => setUseMockData(true)}
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                  >
                    Switch to Mock Data
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Share Table column */}
          <div>
            <ShareTable tokens={selectedTokens} />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <OrderForm
            baseToken="ETH"
            basketTokens={selectedTokens}
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
