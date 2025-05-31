import { useState, useEffect } from 'react';
import { useQuery, gql } from '@apollo/client';
import { LineData, Time } from 'lightweight-charts';

const GET_HISTORICAL_PRICES = gql`
  query GetHistoricalPrices($limit: Int) {
    historicalPrices(
      limit: $limit
      orderBy: "timestamp"
      orderDirection: "asc"
    ) {
      items {
        id
        timestamp
        ethPrice
        btcPrice
        ethShare
        btcShare
      }
    }
  }
`;

export interface TokenChartData {
  symbol: string;
  data: LineData[];
  color: string;
}

const TOKEN_COLORS: Record<string, string> = {
  BTC: '#F7931A',  // Bitcoin orange
  ETH: '#627EEA',  // Ethereum blue
};

// Convert BigInt share to percentage
function shareToPercentage(share: string): number {
  try {
    return Number(BigInt(share)) / 1e16; // Convert to percentage (0-100)
  } catch {
    return 0;
  }
}

export function useHistoricalSharesChartData() {
  const [chartData, setChartData] = useState<TokenChartData[]>([]);
  
  const { data, loading, error } = useQuery(GET_HISTORICAL_PRICES, {
    variables: { limit: 1000 },
    pollInterval: 10000,
  });

  useEffect(() => {
    if (data?.historicalPrices?.items && data.historicalPrices.items.length > 0) {
      const ethData: LineData[] = [];
      const btcData: LineData[] = [];
      
      // Process each historical price point
      data.historicalPrices.items.forEach((item: any) => {
        const time = item.timestamp as Time;
        
        ethData.push({
          time,
          value: shareToPercentage(item.ethShare),
        });
        
        btcData.push({
          time,
          value: shareToPercentage(item.btcShare),
        });
      });
      
      // Remove duplicates by timestamp
      const dedupData = (data: LineData[]) => {
        const seen = new Set<number>();
        return data.filter(point => {
          const time = point.time as number;
          if (seen.has(time)) return false;
          seen.add(time);
          return true;
        });
      };
      
      setChartData([
        {
          symbol: 'ETH',
          data: dedupData(ethData),
          color: TOKEN_COLORS.ETH,
        },
        {
          symbol: 'BTC',
          data: dedupData(btcData),
          color: TOKEN_COLORS.BTC,
        },
      ]);
    }
  }, [data]);

  return { chartData, loading, error };
}