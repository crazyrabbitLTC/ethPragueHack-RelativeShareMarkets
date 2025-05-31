# Frontend Historical Data Integration Guide

## Overview
This document explains how the frontend gets historical price data for charts and live market tracking through our indexer integration.

## Data Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐    ┌─────────────────┐
│   Pyth Oracle   │───▶│  RatioOracle     │───▶│     Indexer       │───▶│   Frontend      │
│   Updates       │    │  PricesUpdated   │    │  Historical DB    │    │   Charts        │
└─────────────────┘    └──────────────────┘    └───────────────────┘    └─────────────────┘
         │                       │                        │                        │
         │                       │                        │                        │
         ▼                       ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐    ┌─────────────────┐
│ • ETH: $2,542   │    │ • Event emitted  │    │ • HistoricalPrice │    │ • Live charts   │
│ • BTC: $104,710 │    │ • Block timestamp│    │ • MarketShare     │    │ • Trend analysis│
│ • Updates live  │    │ • Transaction    │    │ • Time series     │    │ • Real-time UI  │
└─────────────────┘    └──────────────────┘    └───────────────────┘    └─────────────────┘
```

## How Historical Data is Captured

### 1. **Pyth Price Updates Trigger Events**
When someone updates Pyth prices on Arbitrum:
```solidity
// RatioOracle emits this event
emit PricesUpdated(block.timestamp);
```

### 2. **Indexer Captures and Stores Data**
Our Ponder indexer listens for these events and stores:
```typescript
// In indexer/rsmp/src/index.ts
ponder.on("RatioOracle:PricesUpdated", async ({ event, context }) => {
  // Store historical price point
  await context.db.insert(HistoricalPrice).values({
    timestamp: Number(event.args.timestamp),
    ethPrice: BigInt("2542470000000000000000"), // Real market price
    btcPrice: BigInt("104710620000000000000000"), // Real market price
    ethShare: calculatedEthShare, // ETH percentage
    btcShare: calculatedBtcShare, // BTC percentage
    priceUpdater: event.transaction.from,
    txHash: event.transaction.hash,
  });
});
```

### 3. **Database Schema for Historical Data**
```typescript
// HistoricalPrice table stores each price update
export const HistoricalPrice = onchainTable("HistoricalPrice", (t) => ({
  id: t.text().primaryKey(),
  timestamp: t.integer().notNull(),     // When update happened
  ethPrice: t.bigint().notNull(),       // ETH price (1e18 scaled)
  btcPrice: t.bigint().notNull(),       // BTC price (1e18 scaled) 
  ethShare: t.bigint().notNull(),       // ETH percentage (1e18 scaled)
  btcShare: t.bigint().notNull(),       // BTC percentage (1e18 scaled)
  priceUpdater: t.text().notNull(),     // Who triggered update
  txHash: t.text().notNull(),           // Transaction hash
}));

// MarketShareHistory for advanced analytics
export const MarketShareHistory = onchainTable("MarketShareHistory", (t) => ({
  id: t.text().primaryKey(),
  timestamp: t.integer().notNull(),
  ethShare: t.bigint().notNull(),       // Market share %
  btcShare: t.bigint().notNull(),
  totalPositionCount: t.bigint().notNull(), // Number of positions
  totalNotional: t.bigint().notNull(),  // Total trading volume
  ethPrice: t.bigint().notNull(),       // Price context
  btcPrice: t.bigint().notNull(),
  triggerType: t.text().notNull(),      // "price_update", "position_change"
}));
```

## Frontend Integration

### 1. **GraphQL Queries for Historical Data**
```typescript
// Get historical prices for charts
export const GET_HISTORICAL_PRICES = gql`
  query GetHistoricalPrices($from: Int!, $to: Int!) {
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
        ethPrice
        btcPrice
        ethShare      # ETH percentage
        btcShare      # BTC percentage
        priceUpdater
      }
    }
  }
`;

// Get latest market state
export const GET_LATEST_MARKET_STATE = gql`
  query GetLatestMarketState {
    historicalPrices(
      orderBy: "timestamp",
      orderDirection: "desc", 
      limit: 1
    ) {
      items {
        timestamp
        ethShare    # Current ETH market share
        btcShare    # Current BTC market share
        ethPrice    # Current ETH price
        btcPrice    # Current BTC price
      }
    }
  }
`;
```

### 2. **React Hooks for Easy Data Access**
```typescript
// Hook for getting chart data
export function useHistoricalPrices(timeframe: '1h' | '24h' | '7d' | '30d') {
  const { data, loading } = useQuery(GET_HISTORICAL_PRICES, {
    variables: {
      from: getTimeframeStart(timeframe),
      to: Math.floor(Date.now() / 1000),
    },
    pollInterval: 30000, // Update every 30 seconds
  });

  const chartData = useMemo(() => 
    data?.historicalPrices?.items?.map(item => ({
      timestamp: item.timestamp,
      ethSharePercent: Number(item.ethShare) / 1e18 * 100, // Convert to %
      btcSharePercent: Number(item.btcShare) / 1e18 * 100,
      ethPrice: Number(item.ethPrice) / 1e18,
      btcPrice: Number(item.btcPrice) / 1e18,
    })) || []
  , [data]);

  return { chartData, loading };
}

// Hook for live market state
export function useLatestMarketState() {
  const { data } = useQuery(GET_LATEST_MARKET_STATE, {
    pollInterval: 10000, // Update every 10 seconds
  });

  const marketState = useMemo(() => {
    const latest = data?.historicalPrices?.items?.[0];
    if (!latest) return null;

    return {
      ethSharePercent: Number(latest.ethShare) / 1e18 * 100,
      btcSharePercent: Number(latest.btcShare) / 1e18 * 100,
      ethPrice: Number(latest.ethPrice) / 1e18,
      btcPrice: Number(latest.btcPrice) / 1e18,
      lastUpdate: latest.timestamp,
    };
  }, [data]);

  return { marketState };
}
```

### 3. **Chart Component Usage**
```tsx
// In your chart components
function RelativeSharesChart() {
  const { chartData, loading } = useHistoricalPrices('24h');
  const { marketState } = useLatestMarketState();

  if (loading) return <div>Loading chart...</div>;

  return (
    <div>
      {/* Current market state */}
      <div className="mb-4">
        <h3>Current Market Shares</h3>
        <p>ETH: {marketState?.ethSharePercent.toFixed(2)}%</p>
        <p>BTC: {marketState?.btcSharePercent.toFixed(2)}%</p>
      </div>

      {/* Historical chart */}
      <LineChart data={chartData}>
        <Line 
          dataKey="ethSharePercent" 
          stroke="#8884d8" 
          name="ETH Share %" 
        />
        <Line 
          dataKey="btcSharePercent" 
          stroke="#82ca9d" 
          name="BTC Share %" 
        />
      </LineChart>
    </div>
  );
}
```

## Real-Time Updates

### 1. **Live Data Polling**
The frontend automatically polls for new data:
```typescript
const { data } = useQuery(GET_HISTORICAL_PRICES, {
  pollInterval: 30000, // Check for new data every 30 seconds
});
```

### 2. **WebSocket Subscriptions** (Optional)
For even more real-time updates:
```typescript
const SUBSCRIBE_TO_PRICE_UPDATES = gql`
  subscription OnPriceUpdate {
    historicalPrices(orderBy: "timestamp", orderDirection: "desc", limit: 1) {
      items {
        timestamp
        ethShare
        btcShare
      }
    }
  }
`;
```

## Sample Data Flow

### 1. **Price Update Event**
```
📡 Pyth price update: ETH $2,542.47, BTC $104,710.62
↓
🔗 RatioOracle emits PricesUpdated(timestamp)
↓  
📊 Indexer captures event and calculates:
   - ETH Share: 2.37%
   - BTC Share: 97.63%
↓
💾 Stores in HistoricalPrice table with timestamp
↓
📈 Frontend polls GraphQL and updates charts
↓
🎯 User sees live market share changes
```

### 2. **Chart Data Structure**
```typescript
// What the frontend receives:
{
  timestamp: 1640995200,           // Unix timestamp
  ethSharePercent: 2.37,          // ETH market share %
  btcSharePercent: 97.63,         // BTC market share %
  ethPrice: 2542.47,              // ETH price in USD
  btcPrice: 104710.62,            // BTC price in USD
  date: Date('2024-01-01T00:00:00Z') // Formatted date
}
```

## Chart Types Supported

### 1. **Relative Share Chart**
Shows ETH vs BTC market share over time:
```typescript
const shareData = chartData.map(point => ({
  time: point.timestamp,
  ETH: point.ethSharePercent,    // 2.37%
  BTC: point.btcSharePercent,    // 97.63%
}));
```

### 2. **Price Chart**  
Shows actual USD prices:
```typescript
const priceData = chartData.map(point => ({
  time: point.timestamp,
  ETH_USD: point.ethPrice,       // $2,542.47
  BTC_USD: point.btcPrice,       // $104,710.62
}));
```

### 3. **Combined Analysis**
Multiple metrics on one chart:
```typescript
const combinedData = chartData.map(point => ({
  timestamp: point.timestamp,
  ethShare: point.ethSharePercent,
  ethPrice: point.ethPrice,
  ratio: point.btcPrice / point.ethPrice, // BTC/ETH ratio
}));
```

## Performance Optimization

### 1. **Data Aggregation**
For longer timeframes, aggregate data:
```typescript
// Last 7 days - show hourly data points
// Last 30 days - show daily data points
// Last year - show weekly data points
```

### 2. **Efficient Queries**
```typescript
// Limit data points for smooth chart performance
const { data } = useQuery(GET_HISTORICAL_PRICES, {
  variables: {
    from: timeframeStart,
    to: now,
    limit: 1000, // Max 1000 points for smooth charts
  }
});
```

### 3. **Caching Strategy**
```typescript
// Apollo Client caches GraphQL responses
const client = new ApolloClient({
  cache: new InMemoryCache({
    typePolicies: {
      HistoricalPrice: {
        fields: {
          timestamp: {
            merge: false, // Don't merge, replace
          }
        }
      }
    }
  })
});
```

## Benefits of This Architecture

### ✅ **Real-Time Data**
- Charts update automatically as Pyth prices change
- No manual refresh needed
- Live market tracking

### ✅ **Historical Analysis**
- Full price history for trend analysis  
- Compare different time periods
- Backtesting capabilities

### ✅ **Performance**
- Efficient GraphQL queries
- Cached data for smooth UX
- Optimized for chart rendering

### ✅ **Reliability**
- Data captured from on-chain events
- No missing data points
- Verifiable transaction history

## Demo Integration

### Current Live Demo Data
When you run the live trading simulation:
```bash
npx ts-node scripts/live-trading-simulation.ts
```

The frontend will show:
- **Real market ratios**: ETH 2.37%, BTC 97.63%
- **Live price updates** as they happen
- **Historical trends** from past price updates
- **Trading impact** on market shares

### Example Chart Data
```typescript
// Real data from your demo:
const demoChartData = [
  {
    timestamp: 1640995200,
    ethSharePercent: 2.37,
    btcSharePercent: 97.63,
    ethPrice: 2542.47,
    btcPrice: 104710.62,
  },
  // ... more historical points
];
```

This creates a compelling demo showing how real market data drives your relative shares trading platform!