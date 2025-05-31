# Historical Price Data Strategy

## Overview
To provide historical price data for frontend charts, we need to capture and store Pyth price updates as they happen on-chain. This creates a time-series database of ETH/BTC ratios and market shares.

## Data Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│   Pyth Network  │───▶│  Arbitrum Chain  │───▶│     Indexer       │
│                 │    │                  │    │                   │
└─────────────────┘    └──────────────────┘    └───────────────────┘
         │                       │                        │
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│ • Price feeds   │    │ • PricesUpdated  │    │ • Historical DB   │
│ • ETH/USD       │    │ • Ratio changes  │    │ • Time series     │
│ • BTC/USD       │    │ • Block events   │    │ • Chart data      │
└─────────────────┘    └──────────────────┘    └───────────────────┘
                                                         │
                                                         ▼
                                               ┌───────────────────┐
                                               │     Frontend      │
                                               │ • Charts          │
                                               │ • Historical view │
                                               │ • Trend analysis  │
                                               └───────────────────┘
```

## Implementation Strategy

### Option 1: Index RatioOracle Events (Recommended)
Capture when our oracle gets updated with new Pyth data:

```typescript
// In indexer/rsmp/src/index.ts
ponder.on("RatioOracle:PricesUpdated", async ({ event, context }) => {
  // Get current prices from oracle state
  const ethPrice = await getRealTimePrice("ETH");
  const btcPrice = await getRealTimePrice("BTC");
  const ratio = calculateRatio(ethPrice, btcPrice);
  
  // Store historical price point
  await context.db.insert(HistoricalPrice).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    timestamp: Number(event.block.timestamp),
    blockNumber: event.block.number,
    ethPrice: ethPrice,
    btcPrice: btcPrice,
    ethShare: ratio,
    btcShare: (10n**18n) - ratio,
    priceUpdater: event.transaction.from,
    txHash: event.transaction.hash,
  });
});
```

### Option 2: Index Pyth Contract Directly (Advanced)
Track all Pyth price feed updates:

```typescript
ponder.on("PythOracle:PriceFeedUpdate", async ({ event, context }) => {
  const { id, publishTime, price, conf } = event.args;
  
  // Only track ETH and BTC feeds
  const priceFeeds = {
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace": "ETH",
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43": "BTC"
  };
  
  const token = priceFeeds[id];
  if (!token) return;
  
  await context.db.insert(PythPriceUpdate).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    token,
    priceId: id,
    price: BigInt(price),
    confidence: BigInt(conf),
    publishTime: Number(publishTime),
    blockTimestamp: Number(event.block.timestamp),
    blockNumber: event.block.number,
    updater: event.transaction.from,
    txHash: event.transaction.hash,
  });
  
  // Calculate and store ratio when both prices available
  await calculateHistoricalRatio(context, event.block);
});
```

### Option 3: Periodic Snapshots (Backup)
Take regular snapshots of current state:

```typescript
// Block handler for periodic snapshots
ponder.on("RatioOracle:block", async ({ event, context }) => {
  const block = event.block;
  
  // Take snapshot every 100 blocks (~5 minutes on Arbitrum)
  if (block.number % 100n === 0n) {
    try {
      const currentRatio = await ratioOracle.getRatioShare("ETH", "BTC");
      
      await context.db.insert(RatioSnapshot).values({
        id: `snapshot-${block.number}`,
        timestamp: Number(block.timestamp),
        blockNumber: block.number,
        ethShare: currentRatio,
        btcShare: (10n**18n) - currentRatio,
        snapshotType: "periodic",
      });
    } catch (error) {
      // Handle stale prices gracefully
      console.log("Snapshot skipped - prices may be stale");
    }
  }
});
```

## Database Schema

### Historical Price Table
```typescript
export const HistoricalPrice = onchainTable("HistoricalPrice", (t) => ({
  id: t.text().primaryKey(),
  timestamp: t.integer().notNull(),
  blockNumber: t.bigint().notNull(),
  ethPrice: t.bigint().notNull(),       // Raw ETH price (1e18 scaled)
  btcPrice: t.bigint().notNull(),       // Raw BTC price (1e18 scaled)
  ethShare: t.bigint().notNull(),       // ETH percentage (1e18 scaled)
  btcShare: t.bigint().notNull(),       // BTC percentage (1e18 scaled)
  priceUpdater: t.text().notNull(),     // Who triggered the update
  txHash: t.text().notNull(),
  
  // Indexes for efficient querying
  timestampIndex: t.index("timestamp"),
  blockIndex: t.index("blockNumber"),
}));
```

### Market Share Time Series
```typescript
export const MarketShareHistory = onchainTable("MarketShareHistory", (t) => ({
  id: t.text().primaryKey(),
  timestamp: t.integer().notNull(),
  blockNumber: t.bigint().notNull(),
  
  // Market data
  ethShare: t.bigint().notNull(),       // ETH market share %
  btcShare: t.bigint().notNull(),       // BTC market share %
  totalPositionCount: t.bigint().notNull(), // Number of open positions
  totalNotional: t.bigint().notNull(),  // Total position value
  
  // Price context
  ethPrice: t.bigint().notNull(),       // ETH price at this time
  btcPrice: t.bigint().notNull(),       // BTC price at this time
  
  // Event context
  triggerType: t.text().notNull(),      // "price_update", "position_change", "periodic"
  triggerTx: t.text().notNull(),
}));
```

## Frontend GraphQL Queries

### Get Historical Chart Data
```graphql
query GetHistoricalPrices($from: Int!, $to: Int!, $interval: String!) {
  historicalPrices(
    where: {
      timestamp_gte: $from,
      timestamp_lte: $to
    },
    orderBy: "timestamp",
    orderDirection: "asc"
  ) {
    items {
      timestamp
      ethShare      # For relative share chart
      btcShare
      ethPrice      # For price chart
      btcPrice
    }
  }
}
```

### Get Market Share Trends
```graphql
query GetMarketShareTrends($timeframe: String!) {
  marketShareHistory(
    where: {
      timestamp_gte: $timeframe
    },
    orderBy: "timestamp",
    orderDirection: "asc"
  ) {
    items {
      timestamp
      ethShare
      btcShare
      totalPositionCount
      totalNotional
    }
  }
}
```

### Get Recent Price Updates
```graphql
query GetRecentUpdates($limit: Int!) {
  historicalPrices(
    orderBy: "timestamp",
    orderDirection: "desc",
    limit: $limit
  ) {
    items {
      timestamp
      ethPrice
      btcPrice
      ethShare
      priceUpdater
      txHash
    }
  }
}
```

## Implementation Priority

### Phase 1: Basic Historical Tracking
1. ✅ Index `RatioOracle:PricesUpdated` events
2. ✅ Store timestamp + ratio data
3. ✅ Provide basic chart data to frontend

### Phase 2: Enhanced Time Series
1. Add price context (ETH/BTC actual prices)
2. Track position count changes
3. Calculate market statistics

### Phase 3: Advanced Analytics
1. Index Pyth contract directly for granular data
2. Add confidence intervals and data quality metrics
3. Implement time-weighted average prices (TWAP)

## Data Retention Strategy

### Short-term (Real-time)
- **1-minute granularity** for last 24 hours
- **Store every price update** for active trading

### Medium-term (Recent history) 
- **5-minute granularity** for last 7 days
- **Aggregate updates** to reduce storage

### Long-term (Historical analysis)
- **1-hour granularity** for last 30 days
- **Daily snapshots** for longer periods

## Sample Implementation

### Event Handler
```typescript
ponder.on("RatioOracle:PricesUpdated", async ({ event, context }) => {
  try {
    // Get current state from oracle
    const ethPrice = await getOraclePrice("ETH", event.block.number);
    const btcPrice = await getOraclePrice("BTC", event.block.number);
    
    if (!ethPrice || !btcPrice) {
      console.log("Skipping - prices not available");
      return;
    }
    
    // Calculate shares
    const totalValue = ethPrice + btcPrice;
    const ethShare = (ethPrice * 10n**18n) / totalValue;
    const btcShare = 10n**18n - ethShare;
    
    // Store historical data point
    await context.db.insert(HistoricalPrice).values({
      id: `${event.transaction.hash}-${event.log.logIndex}`,
      timestamp: Number(event.block.timestamp),
      blockNumber: event.block.number,
      ethPrice,
      btcPrice,
      ethShare,
      btcShare,
      priceUpdater: event.transaction.from,
      txHash: event.transaction.hash,
    });
    
    // Update latest market shares for current display
    await updateCurrentMarketShares(context, event.block, ethShare, btcShare);
    
  } catch (error) {
    console.error("Failed to process price update:", error);
  }
});
```

### Data Aggregation Function
```typescript
async function updateCurrentMarketShares(context: any, block: any, ethShare: bigint, btcShare: bigint) {
  // Get current position statistics
  const positions = await context.db.Position.findMany({
    where: { status: "open" }
  });
  
  const totalPositions = BigInt(positions.length);
  const totalNotional = positions.reduce((sum, pos) => sum + BigInt(pos.notional), 0n);
  
  // Store current market state
  await context.db.insert(MarketShareHistory).values({
    id: `market-${block.timestamp}`,
    timestamp: Number(block.timestamp),
    blockNumber: block.number,
    ethShare,
    btcShare,
    totalPositionCount: totalPositions,
    totalNotional,
    ethPrice: 0n, // Would get from oracle call
    btcPrice: 0n, // Would get from oracle call
    triggerType: "price_update",
    triggerTx: "system",
  });
}
```

## Monitoring and Health Checks

### Data Quality Checks
```typescript
// Check for data gaps
async function checkDataContinuity(context: any) {
  const recentPrices = await context.db.HistoricalPrice.findMany({
    orderBy: { timestamp: "desc" },
    limit: 100
  });
  
  // Check for gaps > 10 minutes
  for (let i = 1; i < recentPrices.length; i++) {
    const gap = recentPrices[i-1].timestamp - recentPrices[i].timestamp;
    if (gap > 600) { // 10 minutes
      console.warn(`Price data gap detected: ${gap} seconds`);
    }
  }
}
```

### Update Frequency Monitoring
```typescript
// Monitor update frequency
async function monitorUpdateFrequency(context: any) {
  const lastHour = Math.floor(Date.now() / 1000) - 3600;
  
  const updatesLastHour = await context.db.HistoricalPrice.findMany({
    where: { timestamp_gte: lastHour }
  });
  
  console.log(`Price updates in last hour: ${updatesLastHour.length}`);
  
  if (updatesLastHour.length < 6) { // Less than 6 updates/hour
    console.warn("Price update frequency is low");
  }
}
```

## Frontend Integration

### Chart Component Usage
```typescript
// In frontend components
const { data: chartData, loading } = useQuery(GET_HISTORICAL_PRICES, {
  variables: {
    from: Math.floor(Date.now() / 1000) - 86400, // Last 24 hours
    to: Math.floor(Date.now() / 1000),
    interval: "5m"
  }
});

// Transform for chart display
const chartPoints = chartData?.historicalPrices?.items?.map(point => ({
  timestamp: point.timestamp * 1000, // Convert to milliseconds
  ethShare: Number(point.ethShare) / 1e18 * 100, // Convert to percentage
  btcShare: Number(point.btcShare) / 1e18 * 100,
}));
```

## Benefits of This Approach

### ✅ Real-Time Updates
- Charts update as new price data arrives
- No polling required - GraphQL subscriptions possible

### ✅ Historical Analysis
- Full price history for trend analysis
- Backtesting capabilities for strategies

### ✅ Performance
- Efficient queries with proper indexing
- Data aggregation for different time scales

### ✅ Reliability  
- Captures all on-chain price updates
- No dependence on external APIs for historical data