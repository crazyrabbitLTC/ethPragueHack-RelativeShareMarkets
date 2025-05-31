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
import { TradingViewWithPositions } from "./components/chart/TradingViewWithPositions"
import { TraderSelector } from "./components/trader-selector"
import { mockTokensData, mockPositionData } from "./data/mock-data"
import { useLatestPrices } from "./lib/hooks/usePrices"
import { useAllPositions, useUserPositions, transformPositionForUI } from "./lib/hooks/usePositions"
import { usePositionUpdates } from "./lib/hooks/usePositionUpdates"
import { useRelativeSharesChartData } from "./lib/hooks/useRelativeSharesChartData"
import { useLivePricesContext } from "./lib/contexts/LivePricesContext"
// import { useToasts } from "./hooks/useToasts"; // If toasts are managed globally or triggered here

export default function TradingInterface() {
  const [isConnected, setIsConnected] = useState(true)
  const [showAsAreaChart, setShowAsAreaChart] = useState(false)
  const [useMockData, setUseMockData] = useState(false) // Use real indexer data by default
  const [selectedTrader, setSelectedTrader] = useState<string | undefined>(undefined)
  const [useEnhancedChart, setUseEnhancedChart] = useState(false) // Start with simple chart by default
  
  // Fetch real block number from indexer
  const { latestBlockNumber } = useLatestPrices(1, 5000); // Poll every 5 seconds
  const displayBlockNumber = latestBlockNumber || 18234567; // Fallback to default

  // Fetch positions data based on selected trader
  const { positions: allPositions, stats: allPositionStats, loading: allPositionsLoading, error: allPositionsError } = useAllPositions(100);
  const { positions: traderPositions, stats: traderStats, loading: traderPositionsLoading, error: traderPositionsError } = useUserPositions(selectedTrader);
  
  // Use trader-specific positions if a trader is selected, otherwise use all positions
  const positions = selectedTrader ? traderPositions : allPositions;
  const positionStats = selectedTrader ? traderStats : allPositionStats;
  const positionsLoading = selectedTrader ? traderPositionsLoading : allPositionsLoading;
  const positionsError = selectedTrader ? traderPositionsError : allPositionsError;
  
  // Fetch position updates for the enhanced chart
  const { positionUpdates, loading: updatesLoading, error: updatesError } = usePositionUpdates({
    trader: selectedTrader,
    limit: 1000,
  });
  
  // Get live prices from context
  const { ethShare, btcShare, prices, isLive } = useLivePricesContext();
  
  // Use real tokens from the indexer (ETH/BTC for SimplePerpV2) - memoized to prevent re-renders
  const realTokensData = useMemo(() => {
    const ethPrice = prices.find(p => p.symbol === 'ETH');
    const btcPrice = prices.find(p => p.symbol === 'BTC');
    
    return [
      { 
        symbol: 'ETH', 
        currentShare: ethShare ?? 50,
        weight: 50,
        price: ethPrice?.price
      },
      { 
        symbol: 'BTC', 
        currentShare: btcShare ?? 50,
        weight: 50,
        price: btcPrice?.price
      },
    ];
  }, [ethShare, btcShare, prices]);
  
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
  
  // Use the first open position for display, or mock data with live share if none
  const firstOpenPosition = positions.find(p => p.status === 'open');
  const displayPosition = firstOpenPosition 
    ? transformPositionForUI(firstOpenPosition)
    : {
        ...mockPositionData,
        currentShare: ethShare ?? mockPositionData.currentShare
      };

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

        {/* Loading states */}
        {(chartLoading || positionsLoading) && (
          <div className="text-center py-10">
            <div className="inline-flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Loading {chartLoading ? 'chart' : 'position'} data...
            </div>
          </div>
        )}
        
        {/* Chart and Share Table */}
        <div className="space-y-6">
          {/* Chart toggle buttons */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUseEnhancedChart(!useEnhancedChart)}
                className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
              >
                {useEnhancedChart ? 'Simple Chart' : 'Enhanced Chart'}
              </button>
              {!useEnhancedChart && (
                <button
                  onClick={() => setShowAsAreaChart(!showAsAreaChart)}
                  className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
                >
                  {showAsAreaChart ? 'Show Lines' : 'Show Area'}
                </button>
              )}
              {useEnhancedChart && (
                <div className="w-48">
                  <TraderSelector
                    selectedTrader={selectedTrader}
                    onChange={setSelectedTrader}
                    placeholder="All traders"
                  />
                </div>
              )}
            </div>
            {selectedTrader && (
              <div className="text-sm text-gray-400">
                Showing data for trader: <span className="font-mono text-white">{selectedTrader.slice(0, 6)}...{selectedTrader.slice(-4)}</span>
              </div>
            )}
          </div>
          
          {/* Enhanced Chart with Positions */}
          {useEnhancedChart && !chartLoading && !chartError && chartData.length > 0 && (
            <TradingViewWithPositions
              marketData={chartData}
              positions={positions}
              positionUpdates={positionUpdates}
              height={500}
              selectedTrader={selectedTrader}
            />
          )}
          
          {/* Simple Chart and Share Table in two columns */}
          {!useEnhancedChart && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Chart column */}
              <div>
                {!chartLoading && !chartError && chartData.length > 0 && (
                  <RelativeSharesChart 
                    data={chartData}
                    height={300}
                    showAsArea={showAsAreaChart}
                  />
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
          )}
          
          {/* Share Table for enhanced chart (full width) */}
          {useEnhancedChart && (
            <div className="w-full">
              <ShareTable tokens={selectedTokens} />
            </div>
          )}
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
