import { useQuery } from '@apollo/client';
import { GET_USER_POSITIONS, GET_ALL_POSITIONS } from '@/lib/graphql/queries';
import { Position, PositionsResponse } from '@/lib/graphql/types';

// Utility functions for BigInt formatting
function formatBigInt(value: string | null | undefined): number {
  if (!value) return 0;
  try {
    return Number(BigInt(value)) / 1e18; // Convert from 18 decimal places
  } catch {
    return 0;
  }
}

function calculatePnlPercent(pnl: string | null | undefined, notional: string): number {
  if (!pnl || !notional) return 0;
  try {
    const pnlValue = Number(BigInt(pnl)) / 1e18;
    const notionalValue = Number(BigInt(notional)) / 1e18;
    return notionalValue > 0 ? (pnlValue / notionalValue) * 100 : 0;
  } catch {
    return 0;
  }
}

// Hook to fetch user positions
export function useUserPositions(userAddress?: string) {
  const { data, loading, error, refetch } = useQuery<PositionsResponse>(
    GET_USER_POSITIONS,
    {
      variables: { userAddress },
      skip: !userAddress,
      pollInterval: 5000, // Poll every 5 seconds for real-time updates
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
      pollInterval: 5000, // Poll every 5 seconds for real-time updates
    }
  );

  const positions = data?.positions?.items || [];

  // Calculate aggregated stats for all positions
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

// Transform position data for UI components
export function transformPositionForUI(position: Position) {
  const pnlValue = formatBigInt(position.pnl);
  const notionalValue = formatBigInt(position.notional);
  const entryShareValue = formatBigInt(position.entryShares); // Updated field name
  const marginValue = formatBigInt(position.margin); // Updated field name
  const currentShareValue = formatBigInt(position.exitShares) || entryShareValue; // Use exit if available
  
  return {
    id: position.id,
    side: position.isLong ? 'long' as const : 'short' as const,
    entryShare: entryShareValue,
    currentShare: currentShareValue,
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