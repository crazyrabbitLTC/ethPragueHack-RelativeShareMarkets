import { useQuery } from '@apollo/client';
import { GET_POSITION_UPDATES } from '@/lib/graphql/queries';
import { PositionUpdate } from '@/lib/graphql/types';

interface PositionUpdatesResponse {
  positionUpdates: {
    items: PositionUpdate[];
  };
}

interface UsePositionUpdatesOptions {
  trader?: string;
  from?: number;
  to?: number;
  limit?: number;
  pollInterval?: number;
}

export function usePositionUpdates({
  trader,
  from,
  to,
  limit = 1000,
  pollInterval = 5000,
}: UsePositionUpdatesOptions = {}) {
  const { data, loading, error, refetch } = useQuery<PositionUpdatesResponse>(
    GET_POSITION_UPDATES,
    {
      variables: { trader, from, to, limit },
      pollInterval,
      skip: false, // Always fetch, even without trader (for all traders)
    }
  );

  const positionUpdates = data?.positionUpdates?.items || [];

  return {
    positionUpdates,
    loading,
    error,
    refetch,
  };
}