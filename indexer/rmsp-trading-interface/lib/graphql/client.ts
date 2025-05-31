import { ApolloClient, InMemoryCache, NormalizedCacheObject } from '@apollo/client';

// Apollo Client instance for connecting to the Ponder indexer
export const apolloClient: ApolloClient<NormalizedCacheObject> = new ApolloClient({
  uri: 'http://localhost:42069/graphql',
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          positions: {
            // Merge incoming positions with existing cache
            merge(existing = { items: [] }, incoming) {
              return {
                ...incoming,
                items: [...(existing.items || []), ...(incoming.items || [])]
              };
            }
          },
          marketShares: {
            // Merge market shares for time-series data
            merge(existing = { items: [] }, incoming) {
              return {
                ...incoming,
                items: [...(existing.items || []), ...(incoming.items || [])]
              };
            }
          }
        }
      }
    }
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
    query: {
      fetchPolicy: 'network-first',
    },
  },
});

export default apolloClient; 