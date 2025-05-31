import { useQuery } from '@apollo/client';
import { GET_LATEST_PRICES } from '@/lib/graphql/queries';
import { PriceUpdatesResponse } from '@/lib/graphql/types';

// Hook to fetch latest price updates and block number
export function useLatestPrices(limit: number = 1, pollInterval?: number) {
  const { data, loading, error } = useQuery<PriceUpdatesResponse>(
    GET_LATEST_PRICES,
    {
      variables: { limit },
      pollInterval, // Auto-refresh data
    }
  );

  const priceUpdates = data?.priceUpdates?.items || [];
  const latestUpdate = priceUpdates[0];
  const latestBlockNumber = latestUpdate ? Number(latestUpdate.blockNumber) : undefined;

  return {
    priceUpdates,
    latestBlockNumber,
    loading,
    error,
  };
} 