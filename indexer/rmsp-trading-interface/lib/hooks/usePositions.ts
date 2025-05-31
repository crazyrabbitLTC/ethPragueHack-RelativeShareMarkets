import { useQuery } from '@apollo/client';
import { GET_USER_POSITIONS, GET_ALL_POSITIONS } from '@/lib/graphql/queries';
import { Position, PositionsResponse } from '@/lib/graphql/types';
import { formatBigInt, calculatePnlPercent } from '@/lib/utils/formatters';

// Hook to fetch user positions
export function useUserPositions(userAddress?: string) {
  const { data, loading, error, refetch } = useQuery<PositionsResponse>(
    GET_USER_POSITIONS,
    {
      variables: { userAddress },
      skip: !userAddress,
    }
  );

  const positions = data?.positions?.items || [];

  // Calculate aggregated stats
  const stats = positions.reduce(
    (acc, position) => {
      const pnlValue = formatBigInt(position.pnl);
      const notionalValue = formatBigInt(position.notional);
      
      return {
        totalPnl: acc.totalPnl + pnlValue,
        totalNotional: acc.totalNotional + notionalValue,
        openPositions: position.status === 'open' ? acc.openPositions + 1 : acc.openPositions,
        closedPositions: position.status === 'closed' ? acc.closedPositions + 1 : acc.closedPositions,
      };
    },
    { totalPnl: 0, totalNotional: 0, openPositions: 0, closedPositions: 0 }
  );

  const totalPnlPercent = stats.totalNotional > 0 
    ? (stats.totalPnl / stats.totalNotional) * 100 
    : 0;

  return {
    positions,
    loading,
    error,
    refetch,
    stats: {
      ...stats,
      totalPnlPercent,
    },
  };
}

// Hook to fetch all positions (for testing without wallet)
export function useAllPositions(limit: number = 10) {
  const { data, loading, error, refetch } = useQuery<PositionsResponse>(
    GET_ALL_POSITIONS,
    {
      variables: { limit },
    }
  );

  const positions = data?.positions?.items || [];

  return {
    positions,
    loading,
    error,
    refetch,
  };
}

// Transform position data for UI components
export function transformPositionForUI(position: Position) {
  const pnlValue = formatBigInt(position.pnl);
  const notionalValue = formatBigInt(position.notional);
  const entryShareValue = formatBigInt(position.entryShare);
  const marginValue = formatBigInt(position.requiredMargin);
  
  return {
    id: position.id,
    side: position.isLong ? 'long' as const : 'short' as const,
    entryShare: entryShareValue,
    currentShare: entryShareValue, // This should come from price data
    pnlUsd: pnlValue,
    pnlPercent: calculatePnlPercent(position.pnl, position.notional),
    margin: marginValue,
    liquidationDistance: 0, // Need to calculate based on current price
    notional: notionalValue,
    status: position.status,
    openedAt: position.openedAt,
    closedAt: position.closedAt,
  };
} 