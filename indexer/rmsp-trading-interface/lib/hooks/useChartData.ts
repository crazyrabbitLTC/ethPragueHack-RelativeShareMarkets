/**
 * Hook to fetch chart data for position share updates
 * 
 * @param positionId - The position ID to fetch updates for (defaults to a hardcoded value)
 * @param limit - Maximum number of updates to fetch
 * @param useMockData - Set to true to use mock data for demonstration (default: false)
 * 
 * Usage:
 * - For real data: useChartData() or useChartData(positionId, 1000, false)
 * - For mock data: useChartData(undefined, 1000, true)
 * 
 * Note: Currently using mock data because positionUpdates are not yet available in the indexer.
 * Once the indexer starts recording position updates, set useMockData to false.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { LineData, Time } from 'lightweight-charts';
import { GET_POSITION_UPDATES } from '@/lib/graphql/queries';
import { gql } from '@apollo/client';

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

// Fallback query to get position data when no updates exist
const GET_POSITION_FOR_CHART = gql`
  query GetPositionForChart($positionId: String!) {
    position(id: $positionId) {
      id
      entryShare
      openedAt
    }
  }
`;

interface PositionForChartResponse {
  position: {
    id: string;
    entryShare: string;
    openedAt: number;
  };
}

// TODO: Make positionId dynamic, possibly passed as a prop or from context
const HARDCODED_POSITION_ID = '0xA34dC124952EdAF7229AAe05DF0955231a8a9e2B-ETH-BTC-1748620272';

// Generate mock time series data for demonstration
function generateMockData(startTime: number, startValue: number, points: number = 50): LineData[] {
  const data: LineData[] = [];
  const now = Math.floor(Date.now() / 1000);
  const timeRange = now - startTime;
  const timeInterval = timeRange / points;
  
  let currentValue = startValue;
  
  for (let i = 0; i <= points; i++) {
    const time = startTime + (timeInterval * i);
    // Add some realistic volatility
    const change = (Math.random() - 0.5) * 2; // -1 to 1 percent change
    currentValue = Math.max(0, Math.min(100, currentValue + change));
    
    data.push({
      time: Math.floor(time) as Time,
      value: Number(currentValue.toFixed(2)),
    });
  }
  
  return data;
}

// Generate mock data for multiple tokens showing relative shares
export function generateMultiTokenMockData(tokens: Array<{symbol: string, initialShare: number}>, points: number = 50): Record<string, LineData[]> {
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - (24 * 60 * 60); // 24 hours ago
  const timeInterval = (24 * 60 * 60) / points;
  
  const result: Record<string, LineData[]> = {};
  const timePoints: number[] = [];
  
  // Generate time points
  for (let i = 0; i <= points; i++) {
    timePoints.push(Math.floor(startTime + (timeInterval * i)));
  }
  
  // Initialize current shares
  const currentShares = tokens.map(t => t.initialShare);
  
  // Generate data for each time point
  timePoints.forEach((time, index) => {
    if (index > 0) {
      // Generate random changes
      const changes = tokens.map(() => (Math.random() - 0.5) * 3); // -1.5% to +1.5% change
      
      // Apply changes
      for (let i = 0; i < currentShares.length; i++) {
        currentShares[i] = Math.max(5, Math.min(95, currentShares[i] + changes[i]));
      }
      
      // Normalize to ensure sum is 100%
      const sum = currentShares.reduce((a, b) => a + b, 0);
      for (let i = 0; i < currentShares.length; i++) {
        currentShares[i] = (currentShares[i] / sum) * 100;
      }
    }
    
    // Add data points for each token
    tokens.forEach((token, i) => {
      if (!result[token.symbol]) {
        result[token.symbol] = [];
      }
      result[token.symbol].push({
        time: time as Time,
        value: Number(currentShares[i].toFixed(2)),
      });
    });
  });
  
  return result;
}

// Utility function for BigInt formatting
function formatBigInt(value: string, decimals: number = 18): number {
  if (!value) return 0;
  try {
    return Number(BigInt(value)) / Math.pow(10, decimals);
  } catch {
    return 0;
  }
}

export function useChartData(positionId: string = HARDCODED_POSITION_ID, limit: number = 1000, useMockData: boolean = false) {
  const { data: updateData, loading: updatesLoading, error: updatesError } = useQuery<PositionUpdatesForChartResponse>(
    GET_POSITION_UPDATES,
    {
      variables: { 
        limit,
      },
      pollInterval: 30000, // Poll for new updates every 30 seconds
      skip: useMockData, // Skip real query if using mock data
    }
  );

  const { data: positionData, loading: positionLoading } = useQuery<PositionForChartResponse>(
    GET_POSITION_FOR_CHART,
    {
      variables: { positionId },
      skip: !positionId || useMockData,
    }
  );

  const [chartData, setChartData] = useState<LineData[]>([]);

  useEffect(() => {
    if (useMockData) {
      // Generate mock data for demonstration
      const mockStartTime = Math.floor(Date.now() / 1000) - (24 * 60 * 60); // 24 hours ago
      const mockStartValue = 45 + Math.random() * 10; // Random start between 45-55%
      setChartData(generateMockData(mockStartTime, mockStartValue));
      return;
    }

    if (updateData?.positionUpdates?.items) {
      // Filter client-side for the specific positionId
      const filteredUpdates = updateData.positionUpdates.items.filter(
        update => update.positionId === positionId
      );
      
      if (filteredUpdates.length > 0) {
        const transformedData = filteredUpdates.map(update => ({
          time: update.timestamp as Time,
          // currentShare is a percentage * 10^18. To display as 0-100, divide by 10^16.
          value: formatBigInt(update.currentShare, 16), 
        }));
        setChartData(transformedData);
      } else if (positionData?.position) {
        // Fallback: use position's entryShare as a single data point
        const fallbackData: LineData[] = [{
          time: positionData.position.openedAt as Time,
          value: formatBigInt(positionData.position.entryShare, 16),
        }];
        setChartData(fallbackData);
      }
    } else if (positionData?.position && !updatesLoading) {
      // If no updates at all, use position data
      const fallbackData: LineData[] = [{
        time: positionData.position.openedAt as Time,
        value: formatBigInt(positionData.position.entryShare, 16),
      }];
      setChartData(fallbackData);
    }
  }, [updateData, positionData, positionId, updatesLoading, useMockData]);

  const loading = useMockData ? false : (updatesLoading || positionLoading);
  const error = useMockData ? null : updatesError;

  return { data: chartData, loading, error };
} 