import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { LineData, Time } from 'lightweight-charts';
import { GET_POSITION_UPDATES_FOR_CHART } from '@/lib/graphql/queries';
import { formatBigInt } from '@/lib/utils/formatters';

interface PositionUpdateItem {
  id: string;
  timestamp: number;
  currentShare: string; // BigInt as string
  positionId: string;
}

interface PositionUpdatesForChartResponse {
  positionUpdates: {
    items: PositionUpdateItem[];
  };
}

// TODO: Make positionId dynamic, possibly passed as a prop or from context
const HARDCODED_POSITION_ID = '0xA34dC124952EdAF7229AAe05DF0955231a8a9e2B-ETH-BTC-1748620272';

export function useChartData(positionId: string = HARDCODED_POSITION_ID, limit: number = 1000) {
  const { data: queryData, loading, error } = useQuery<PositionUpdatesForChartResponse>(
    GET_POSITION_UPDATES_FOR_CHART,
    {
      variables: { 
        positionId, 
        limit,
        // offset: 0, // Add if pagination is needed
      },
      skip: !positionId, // Skip query if no positionId is provided
      pollInterval: 30000, // Poll for new updates every 30 seconds
    }
  );

  const [chartData, setChartData] = useState<LineData[]>([]);

  useEffect(() => {
    if (queryData?.positionUpdates?.items) {
      const transformedData = queryData.positionUpdates.items.map(update => ({
        time: update.timestamp as Time,
        // currentShare is a percentage * 10^18. To display as 0-100, divide by 10^16.
        value: formatBigInt(update.currentShare, 16), 
      }));
      setChartData(transformedData);
    }
  }, [queryData]);

  return { data: chartData, loading, error };
} 