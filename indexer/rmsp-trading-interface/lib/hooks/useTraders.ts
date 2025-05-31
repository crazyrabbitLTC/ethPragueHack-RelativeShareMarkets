import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

// Query to get all unique traders
const GET_ALL_TRADERS = gql`
  query GetAllTraders {
    positions(limit: 1000, orderBy: "openedAt", orderDirection: "desc") {
      items {
        trader
        status
      }
    }
  }
`;

export interface Trader {
  address: string;
  positionCount?: number;
  openPositionCount?: number;
}

export function useTraders() {
  const { data, loading, error } = useQuery(GET_ALL_TRADERS, {
    pollInterval: 30000, // Poll every 30 seconds
  });

  // Extract unique traders
  const traders: Trader[] = [];
  if (data?.positions?.items) {
    const traderMap = new Map<string, { total: number; open: number }>();
    
    data.positions.items.forEach((position: { trader: string; status: string }) => {
      const current = traderMap.get(position.trader) || { total: 0, open: 0 };
      current.total += 1;
      if (position.status === 'open') {
        current.open += 1;
      }
      traderMap.set(position.trader, current);
    });

    traderMap.forEach((counts, address) => {
      traders.push({ 
        address, 
        positionCount: counts.total,
        openPositionCount: counts.open
      });
    });

    // Sort by position count (total)
    traders.sort((a, b) => (b.positionCount || 0) - (a.positionCount || 0));
  }

  return {
    traders,
    loading,
    error,
  };
}