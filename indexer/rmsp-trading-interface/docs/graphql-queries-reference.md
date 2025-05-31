# GraphQL Queries Reference

## Example Queries for Indexer Integration

### Get User Positions

```graphql
query GetUserPositions($userAddress: String!) {
  positions(
    where: { user: $userAddress }
    orderBy: "openedAt"
    orderDirection: "desc"
  ) {
    items {
      id
      user
      baseToken
      quoteToken
      notional
      isLong
      entryShare
      exitShare
      requiredMargin
      pnl
      status
      openedAt
      closedAt
      openTxHash
      closeTxHash
      openBlockNumber
      closeBlockNumber
    }
  }
}
```

### Get Latest Price Updates

```graphql
query GetLatestPrices($limit: Int!) {
  priceUpdates(
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    items {
      id
      timestamp
      blockNumber
      txHash
      updater
    }
  }
}
```

### Get Protocol Statistics

```graphql
query GetProtocolStats {
  protocolStatss {
    items {
      id
      totalVolume
      totalUsers
      totalPositions
      totalPnl
      lastUpdated
    }
  }
}
```

### Get Position by ID

```graphql
query GetPosition($positionId: String!) {
  position(id: $positionId) {
    id
    user
    baseToken
    quoteToken
    notional
    isLong
    entryShare
    exitShare
    requiredMargin
    pnl
    status
    openedAt
    closedAt
  }
}
```

### Get User Trading History

```graphql
query GetUserHistory($userAddress: String!) {
  deposits(where: { user: $userAddress }) {
    items {
      id
      user
      amount
      timestamp
      txHash
    }
  }
  
  withdrawals(where: { user: $userAddress }) {
    items {
      id
      user
      amount
      timestamp
      txHash
    }
  }
  
  positions(where: { user: $userAddress }) {
    items {
      id
      status
      pnl
      openedAt
      closedAt
    }
  }
}
```

### Get Price History for Chart

```graphql
query GetPriceHistory($from: Int!, $to: Int!) {
  priceUpdates(
    where: { 
      timestamp_gte: $from
      timestamp_lte: $to
    }
    orderBy: "timestamp"
    orderDirection: "asc"
  ) {
    items {
      id
      timestamp
      blockNumber
      # Additional price data fields may be needed
    }
  }
}
```

### Get Active Positions Count

```graphql
query GetActivePositionsCount {
  positions(where: { status: "open" }) {
    items {
      id
    }
  }
}
```

## GraphQL Fragments for Reuse

```graphql
fragment PositionDetails on Position {
  id
  user
  baseToken
  quoteToken
  notional
  isLong
  entryShare
  exitShare
  requiredMargin
  pnl
  status
  openedAt
  closedAt
  openTxHash
  closeTxHash
}

fragment PriceUpdateDetails on PriceUpdate {
  id
  timestamp
  blockNumber
  txHash
  updater
}
```

## Subscription Examples (if supported)

```graphql
subscription OnPositionUpdate($userAddress: String!) {
  positionUpdated(where: { user: $userAddress }) {
    ...PositionDetails
  }
}

subscription OnPriceUpdate {
  priceUpdated {
    ...PriceUpdateDetails
  }
}
```

## Notes on Query Parameters

- **Pagination**: Use `limit`, `offset` or cursor-based pagination
- **Filtering**: Use `where` clause with field comparisons
- **Sorting**: Use `orderBy` and `orderDirection`
- **BigInt handling**: Values like `notional`, `margin` are BigInt - need conversion in client

## Type Conversions for UI

```typescript
// Convert BigInt to number for display
const formatBigInt = (value: string): number => {
  return Number(BigInt(value) / BigInt(1e18)); // Assuming 18 decimals
};

// Format addresses
const formatAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Calculate PnL percentage
const calculatePnlPercent = (pnl: string, notional: string): number => {
  const pnlNum = formatBigInt(pnl);
  const notionalNum = formatBigInt(notional);
  return (pnlNum / notionalNum) * 100;
};
``` 