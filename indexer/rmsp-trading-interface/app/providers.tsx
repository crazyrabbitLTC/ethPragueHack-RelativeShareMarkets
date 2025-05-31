'use client';

import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '@/lib/graphql/client';
import { LivePricesProvider } from '@/lib/contexts/LivePricesContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={apolloClient}>
      <LivePricesProvider>
        {children}
      </LivePricesProvider>
    </ApolloProvider>
  );
} 