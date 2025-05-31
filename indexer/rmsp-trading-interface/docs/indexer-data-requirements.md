# Indexer Data Requirements for Relative Shares Trading Interface

## Current State Analysis
The indexer currently provides:
- Binary positions (ETH vs BTC only)
- Entry/exit shares for positions
- Basic protocol statistics
- Empty PositionUpdate and PriceUpdate tables

## Required Data for Relative Shares Chart

### 1. Multi-Token Basket Support
- **Need**: Support for multiple tokens in a basket (e.g., BTC, ETH, SOL, ARB, AVAX)
- **Current**: Only binary ETH-BTC positions
- **Solution**: 
  - Extend position schema to support multi-token baskets
  - Add `basketId` or similar grouping mechanism
  - Track each token's share within the basket

### 2. Time Series Data (PositionUpdate)
- **Need**: Regular updates of position shares over time
- **Current**: PositionUpdate entity exists but has no data
- **Required Fields**:
  - `timestamp`: Unix timestamp of update
  - `currentShare`: Current share percentage (as BigInt scaled by 10^18)
  - `positionId`: Reference to position
  - `tokenSymbol`: Which token in the basket (if multi-token)
  - `blockNumber`: For synchronization

### 3. Market-Wide Share Aggregates
- **Need**: Overall market shares across all positions
- **New Entity Suggestion**: `MarketShare`
  ```
  MarketShare {
    id: String (e.g., "BTC-1748620000")
    tokenSymbol: String
    timestamp: Int
    aggregateShare: BigInt (percentage * 10^18)
    positionCount: Int
    totalVolume: BigInt
  }
  ```

### 4. Price Feed Updates
- **Need**: Regular price updates to calculate relative values
- **Current**: PriceUpdate entity exists but empty
- **Required**:
  - Oracle price feeds for each token
  - Update frequency: At least every block or significant price change
  - Historical data for backtesting

### 5. Basket Configuration
- **New Entity Suggestion**: `BasketConfig`
  ```
  BasketConfig {
    id: String
    name: String (e.g., "Crypto Index")
    tokens: [String] (e.g., ["BTC", "ETH", "SOL", "ARB"])
    weights: [BigInt] (target weights, can be equal or custom)
    createdAt: Int
    isActive: Boolean
  }
  ```

## Data Update Requirements

### Real-Time Updates
1. **Position Updates**: Every time a position's share changes significantly (e.g., > 0.1%)
2. **Price Updates**: Every block or when price changes > 0.5%
3. **Market Share Aggregates**: Every 5-10 blocks or on significant changes

### Historical Data
1. **Backfill Requirements**:
   - At least 24 hours of historical data for charts
   - Granularity: 1-minute intervals minimum
   - Retention: 30 days for detailed data, daily aggregates forever

## API Query Requirements

### For Relative Shares Chart
```graphql
query GetMarketShares($from: Int!, $to: Int!, $interval: String!) {
  marketShares(
    where: { 
      timestamp_gte: $from
      timestamp_lte: $to 
    }
    interval: $interval  # "1m", "5m", "1h", "1d"
  ) {
    items {
      tokenSymbol
      timestamp
      aggregateShare
    }
  }
}
```

### For Individual Position Tracking
```graphql
query GetPositionHistory($positionId: String!, $limit: Int!) {
  positionUpdates(
    where: { positionId: $positionId }
    orderBy: "timestamp"
    orderDirection: "desc"
    limit: $limit
  ) {
    items {
      timestamp
      currentShare
      tokenSymbol  # if multi-token
    }
  }
}
```

## Additional Trading Interface Requirements

### 1. Token Metadata
- Token symbols, names, logos
- Decimal places for display
- Contract addresses

### 2. User Portfolio Analytics
- Aggregate P&L across all positions
- Historical performance
- Risk metrics

### 3. Market Statistics
- 24h volume per token
- Number of active traders
- Total value locked (TVL)
- Average position size

### 4. Order Book Data (if applicable)
- Pending orders
- Liquidity depth
- Spread information

## Implementation Priority

1. **High Priority** (Required for basic functionality):
   - Generate PositionUpdate records with currentShare data
   - Implement multi-token basket support
   - Add market-wide share aggregation

2. **Medium Priority** (Enhanced features):
   - Historical data backfilling
   - Price feed integration
   - User analytics

3. **Low Priority** (Nice to have):
   - Advanced market statistics
   - Order book visualization
   - Social/leaderboard features

## Notes

- All percentage values should be stored as BigInt scaled by 10^18 for precision
- Timestamps should be Unix timestamps (seconds since epoch)
- Consider implementing WebSocket subscriptions for real-time updates
- Ensure data consistency across related entities 