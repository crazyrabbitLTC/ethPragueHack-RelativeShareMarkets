import { useState, useEffect } from 'react';
import { LineData, Time } from 'lightweight-charts';
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

export function useRelativeSharesChartData(
  tokens: Array<{ symbol: string; currentShare: number }>,
  useMockData: boolean = true
): {
  chartData: TokenChartData[];
  loading: boolean;
  error: Error | null;
} {
  const [chartData, setChartData] = useState<TokenChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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
        setLoading(false);
      } catch (err) {
        setError(err as Error);
        setLoading(false);
      }
    } else {
      // TODO: Implement real data fetching when available
      setLoading(false);
    }
  }, [tokens, useMockData]);

  return { chartData, loading, error };
} 