import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { LineData, Time } from 'lightweight-charts';
import { GET_ALL_MARKET_SHARES } from '@/lib/graphql/queries';
import { MarketSharesResponse } from '@/lib/graphql/types';
import { generateMultiTokenMockData } from './useChartData';

export interface TokenChartData {
  symbol: string;
  data: LineData[];
  color: string;
}

// Define colors for each token
const TOKEN_COLORS: Record<string, string> = {
  BTC: '#F7931A',  // Bitcoin orange
  ETH: '#627EEA',  // Ethereum blue
  SOL: '#00FFA3',  // Solana green
  ARB: '#28A0F0',  // Arbitrum blue
  AVAX: '#E84142', // Avalanche red
  BNB: '#F3BA2F',  // Binance yellow
};

// Utility function to convert BigInt string to percentage (0-100)
function formatSharePercentage(aggregateShare: string): number {
  try {
    // aggregateShare is scaled by 1e18, so divide to get percentage
    const shareValue = Number(BigInt(aggregateShare)) / 1e18;
    return shareValue * 100; // Convert to percentage (0-100)
  } catch (error) {
    console.warn('Failed to format share percentage:', aggregateShare, error);
    return 0;
  }
}

export function useRelativeSharesChartData(
  tokens: Array<{ symbol: string; currentShare: number }>,
  useMockData: boolean = false
): {
  chartData: TokenChartData[];
  loading: boolean;
  error: Error | null;
} {
  const [chartData, setChartData] = useState<TokenChartData[]>([]);
  const [mockError, setMockError] = useState<Error | null>(null);

  // Calculate time range for the last 24 hours worth of data
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - (24 * 60 * 60);

  console.log('📊 Chart data hook:', { 
    useMockData, 
    timeRange: { from: oneDayAgo, to: now },
    tokens: tokens.map(t => t.symbol)
  });

  // Query real market share data
  const { data, loading: queryLoading, error: queryError } = useQuery<MarketSharesResponse>(
    GET_ALL_MARKET_SHARES,
    {
      variables: {
        from: oneDayAgo,
        to: now,
        limit: 1000, // Get plenty of data points
      },
      skip: useMockData,
      pollInterval: 10000, // Refresh every 10 seconds
      errorPolicy: 'all', // Allow partial data
      notifyOnNetworkStatusChange: true
    }
  );

  console.log('📊 GraphQL query state:', { 
    loading: queryLoading, 
    error: queryError?.message,
    dataItems: data?.marketShares?.items?.length,
    skip: useMockData
  });

  useEffect(() => {
    if (useMockData) {
      console.log('📊 Using mock data');
      try {
        // Generate mock data for all tokens
        const mockData = generateMultiTokenMockData(
          tokens.map(t => ({ symbol: t.symbol, initialShare: t.currentShare })),
          50
        );

        // Convert to TokenChartData format
        const formattedData: TokenChartData[] = tokens.map(token => ({
          symbol: token.symbol,
          data: mockData[token.symbol] || [],
          color: TOKEN_COLORS[token.symbol] || '#999999',
        }));

        console.log('📊 Mock chart data generated:', formattedData.map(d => ({ 
          symbol: d.symbol, 
          points: d.data.length 
        })));

        setChartData(formattedData);
        setMockError(null);
      } catch (err) {
        console.error('📊 Mock data generation failed:', err);
        setMockError(err as Error);
      }
    } else if (data?.marketShares?.items) {
      console.log('📊 Processing real data:', data.marketShares.items.length, 'items');
      try {
        // Group market share data by token symbol
        const dataByToken: Record<string, LineData[]> = {};
        
        data.marketShares.items.forEach(marketShare => {
          const symbol = marketShare.tokenSymbol;
          const percentage = formatSharePercentage(marketShare.aggregateShare);
          
          if (!dataByToken[symbol]) {
            dataByToken[symbol] = [];
          }
          
          dataByToken[symbol].push({
            time: marketShare.timestamp as Time,
            value: percentage,
          });
        });

        // Sort data points by time for each token
        Object.keys(dataByToken).forEach(symbol => {
          dataByToken[symbol].sort((a, b) => (a.time as number) - (b.time as number));
        });

        // Convert to TokenChartData format
        const formattedData: TokenChartData[] = Object.entries(dataByToken).map(([symbol, data]) => ({
          symbol,
          data,
          color: TOKEN_COLORS[symbol] || '#999999',
        }));

        console.log('📊 Real chart data processed:', formattedData.map(d => ({ 
          symbol: d.symbol, 
          points: d.data.length,
          samplePoint: d.data[0] 
        })));

        setChartData(formattedData);
      } catch (err) {
        console.error('📊 Error processing market share data:', err);
      }
    } else if (!queryLoading && !useMockData) {
      console.log('📊 No data returned from query');
    }
  }, [data, tokens, useMockData, queryLoading]);

  const loading = useMockData ? false : queryLoading;
  const error = useMockData ? mockError : queryError || null;

  console.log('📊 Hook returning:', { 
    loading, 
    error: error?.message, 
    chartDataLength: chartData.length 
  });

  return { chartData, loading, error };
} 