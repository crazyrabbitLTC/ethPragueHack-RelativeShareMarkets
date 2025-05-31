import { useQuery } from '@apollo/client';
import { useMemo } from 'react';
import { GET_HISTORICAL_PRICES, GET_LATEST_MARKET_STATE, GET_RECENT_PRICE_UPDATES } from '../graphql/historical-queries';

// Types for historical price data
export interface HistoricalPricePoint {
  timestamp: number;
  ethPrice: string;
  btcPrice: string;
  ethShare: string;
  btcShare: string;
  priceUpdater: string;
  txHash?: string;
}

export interface ChartDataPoint {
  timestamp: number;
  ethSharePercent: number;
  btcSharePercent: number;
  ethPrice: number;
  btcPrice: number;
  date: Date;
}

export interface MarketState {
  ethSharePercent: number;
  btcSharePercent: number;
  ethPrice: number;
  btcPrice: number;
  lastUpdate: number;
  updater: string;
}

// Hook for getting historical price data for charts
export function useHistoricalPrices(timeframe: '1h' | '24h' | '7d' | '30d' = '24h') {
  const now = Math.floor(Date.now() / 1000);
  const timeframes = {
    '1h': now - 3600,
    '24h': now - 86400,
    '7d': now - 604800,
    '30d': now - 2592000,
  };

  const { data, loading, error, refetch } = useQuery(GET_HISTORICAL_PRICES, {
    variables: {
      from: timeframes[timeframe],
      to: now,
      limit: 1000,
    },
    pollInterval: 30000, // Poll every 30 seconds for live updates
    errorPolicy: 'all',
  });

  const chartData = useMemo(() => {
    if (!data?.historicalPrices?.items) return [];

    return data.historicalPrices.items.map((item: HistoricalPricePoint): ChartDataPoint => ({
      timestamp: item.timestamp,
      ethSharePercent: Number(item.ethShare) / 1e18 * 100,
      btcSharePercent: Number(item.btcShare) / 1e18 * 100,
      ethPrice: Number(item.ethPrice) / 1e18,
      btcPrice: Number(item.btcPrice) / 1e18,
      date: new Date(item.timestamp * 1000),
    }));
  }, [data]);

  return {
    chartData,
    loading,
    error,
    refetch,
    dataPoints: chartData.length,
  };
}

// Hook for getting the latest market state
export function useLatestMarketState() {
  const { data, loading, error } = useQuery(GET_LATEST_MARKET_STATE, {
    pollInterval: 10000, // Poll every 10 seconds
    errorPolicy: 'all',
  });

  const marketState = useMemo((): MarketState | null => {
    const latestPrice = data?.historicalPrices?.items?.[0];
    if (!latestPrice) return null;

    return {
      ethSharePercent: Number(latestPrice.ethShare) / 1e18 * 100,
      btcSharePercent: Number(latestPrice.btcShare) / 1e18 * 100,
      ethPrice: Number(latestPrice.ethPrice) / 1e18,
      btcPrice: Number(latestPrice.btcPrice) / 1e18,
      lastUpdate: latestPrice.timestamp,
      updater: latestPrice.priceUpdater,
    };
  }, [data]);

  return {
    marketState,
    loading,
    error,
  };
}

// Hook for getting recent price updates (for activity feed)
export function useRecentPriceUpdates(limit: number = 20) {
  const { data, loading, error } = useQuery(GET_RECENT_PRICE_UPDATES, {
    variables: { limit },
    pollInterval: 15000, // Poll every 15 seconds
    errorPolicy: 'all',
  });

  const recentUpdates = useMemo(() => {
    if (!data?.historicalPrices?.items) return [];

    return data.historicalPrices.items.map((item: HistoricalPricePoint) => ({
      timestamp: item.timestamp,
      ethSharePercent: Number(item.ethShare) / 1e18 * 100,
      btcSharePercent: Number(item.btcShare) / 1e18 * 100,
      ethPrice: Number(item.ethPrice) / 1e18,
      btcPrice: Number(item.btcPrice) / 1e18,
      updater: item.priceUpdater,
      txHash: item.txHash,
      date: new Date(item.timestamp * 1000),
    }));
  }, [data]);

  return {
    recentUpdates,
    loading,
    error,
  };
}

// Hook for aggregated chart data (useful for different chart types)
export function useAggregatedChartData(timeframe: '1h' | '24h' | '7d' | '30d' = '24h') {
  const { chartData, loading, error } = useHistoricalPrices(timeframe);

  const aggregatedData = useMemo(() => {
    if (!chartData.length) return { ethData: [], btcData: [], combinedData: [] };

    // ETH share data for ETH-focused charts
    const ethData = chartData.map(point => ({
      x: point.timestamp * 1000, // Convert to milliseconds for chart libraries
      y: point.ethSharePercent,
      price: point.ethPrice,
    }));

    // BTC share data for BTC-focused charts  
    const btcData = chartData.map(point => ({
      x: point.timestamp * 1000,
      y: point.btcSharePercent,
      price: point.btcPrice,
    }));

    // Combined data for multi-series charts
    const combinedData = chartData.map(point => ({
      timestamp: point.timestamp * 1000,
      ETH: point.ethSharePercent,
      BTC: point.btcSharePercent,
      ethPrice: point.ethPrice,
      btcPrice: point.btcPrice,
    }));

    return { ethData, btcData, combinedData };
  }, [chartData]);

  return {
    ...aggregatedData,
    loading,
    error,
    totalPoints: chartData.length,
  };
}

// Hook for price change calculations
export function usePriceChangeAnalysis(timeframe: '1h' | '24h' | '7d' | '30d' = '24h') {
  const { chartData, loading, error } = useHistoricalPrices(timeframe);

  const analysis = useMemo(() => {
    if (chartData.length < 2) {
      return {
        ethShareChange: 0,
        btcShareChange: 0,
        ethPriceChange: 0,
        btcPriceChange: 0,
        ethShareChangePercent: 0,
        btcShareChangePercent: 0,
      };
    }

    const latest = chartData[chartData.length - 1];
    const earliest = chartData[0];

    const ethShareChange = latest.ethSharePercent - earliest.ethSharePercent;
    const btcShareChange = latest.btcSharePercent - earliest.btcSharePercent;
    const ethPriceChange = latest.ethPrice - earliest.ethPrice;
    const btcPriceChange = latest.btcPrice - earliest.btcPrice;

    return {
      ethShareChange,
      btcShareChange,
      ethPriceChange,
      btcPriceChange,
      ethShareChangePercent: earliest.ethSharePercent > 0 ? (ethShareChange / earliest.ethSharePercent) * 100 : 0,
      btcShareChangePercent: earliest.btcSharePercent > 0 ? (btcShareChange / earliest.btcSharePercent) * 100 : 0,
      ethPriceChangePercent: earliest.ethPrice > 0 ? (ethPriceChange / earliest.ethPrice) * 100 : 0,
      btcPriceChangePercent: earliest.btcPrice > 0 ? (btcPriceChange / earliest.btcPrice) * 100 : 0,
    };
  }, [chartData]);

  return {
    analysis,
    loading,
    error,
  };
}

// Utility function to format historical data for different chart libraries
export function formatForChartLibrary(
  chartData: ChartDataPoint[], 
  library: 'recharts' | 'chartjs' | 'tradingview' = 'recharts'
) {
  switch (library) {
    case 'recharts':
      return chartData.map(point => ({
        time: point.timestamp,
        ETH: point.ethSharePercent,
        BTC: point.btcSharePercent,
        ethPrice: point.ethPrice,
        btcPrice: point.btcPrice,
      }));
      
    case 'chartjs':
      return {
        labels: chartData.map(point => point.date.toISOString()),
        datasets: [
          {
            label: 'ETH Share %',
            data: chartData.map(point => point.ethSharePercent),
          },
          {
            label: 'BTC Share %', 
            data: chartData.map(point => point.btcSharePercent),
          },
        ],
      };
      
    case 'tradingview':
      return chartData.map(point => ({
        time: point.timestamp,
        value: point.ethSharePercent, // Primary value for TradingView
        btcValue: point.btcSharePercent,
      }));
      
    default:
      return chartData;
  }
}

// Export all hooks and utilities
export default {
  useHistoricalPrices,
  useLatestMarketState,
  useRecentPriceUpdates,
  useAggregatedChartData,
  usePriceChangeAnalysis,
  formatForChartLibrary,
};