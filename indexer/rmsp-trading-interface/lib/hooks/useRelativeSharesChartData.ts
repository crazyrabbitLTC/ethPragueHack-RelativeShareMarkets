import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { LineData, Time } from 'lightweight-charts';
import { GET_LATEST_MARKET_SHARES } from '@/lib/graphql/queries';
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

  // Memoize token symbols to prevent unnecessary re-renders
  const tokenSymbols = useMemo(() => tokens.map(t => t.symbol).join(','), [tokens]);


  // Query real market share data - simplified to avoid timestamp filtering issues
  const { data, loading: queryLoading, error: queryError } = useQuery<MarketSharesResponse>(
    GET_LATEST_MARKET_SHARES,
    {
      variables: {
        limit: 100, // Get recent data points
      },
      skip: useMockData,
      pollInterval: 10000, // Refresh every 10 seconds
      errorPolicy: 'all', // Allow partial data
      notifyOnNetworkStatusChange: true
    }
  );


  useEffect(() => {
    if (useMockData) {
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


        setChartData(formattedData);
        setMockError(null);
      } catch (err) {
        console.error('📊 Mock data generation failed:', err);
        setMockError(err as Error);
      }
    } else if (data?.marketShares?.items && data.marketShares.items.length > 0) {
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

        // Sort and deduplicate data points by time for each token
        Object.keys(dataByToken).forEach(symbol => {
          // Sort by time
          dataByToken[symbol].sort((a, b) => (a.time as number) - (b.time as number));
          
          // Remove duplicates - keep the last value for each timestamp
          const deduped: LineData[] = [];
          const seen = new Set<number>();
          
          // Process in reverse to keep the latest value for each timestamp
          for (let i = dataByToken[symbol].length - 1; i >= 0; i--) {
            const point = dataByToken[symbol][i];
            const time = point.time as number;
            if (!seen.has(time)) {
              seen.add(time);
              deduped.unshift(point); // Add to beginning to maintain order
            }
          }
          
          dataByToken[symbol] = deduped;
        });

        // Convert to TokenChartData format
        const formattedData: TokenChartData[] = Object.entries(dataByToken).map(([symbol, data]) => ({
          symbol,
          data,
          color: TOKEN_COLORS[symbol] || '#999999',
        }));


        setChartData(formattedData);
      } catch (err) {
        console.error('📊 Error processing market share data:', err);
      }
    }
  }, [data, tokenSymbols, useMockData]); // Using tokenSymbols instead of tokens array

  const loading = useMockData ? false : queryLoading;
  const error = useMockData ? mockError : queryError || null;


  return { chartData, loading, error };
} 