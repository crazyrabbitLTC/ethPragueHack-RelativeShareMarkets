# Pyth Oracle Indexing Guide

## Overview
Your indexer should track Pyth price updates to capture real-time price changes and ratio calculations for the frontend.

## What to Index from Pyth

### 1. **Direct Pyth Contract Events** (Optional)
```solidity
// From Pyth contract at 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C
event PriceFeedUpdate(bytes32 indexed id, uint64 publishTime, int64 price, uint64 conf);
```

### 2. **Your RatioOracle Events** (Recommended)
```solidity
// From your RatioOracle at 0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f
event PricesUpdated(uint256 timestamp);
```

### 3. **Enhanced PythPriceTracker Events** (Best)
If you deploy the enhanced tracker:
```solidity
event PythPriceUpdated(
    string indexed token,
    bytes32 indexed priceId, 
    int64 price,
    uint64 confidence,
    uint64 publishTime,
    uint256 blockTimestamp,
    address updater
);

event RatioCalculated(
    string indexed baseToken,
    string indexed quoteToken,
    uint256 basePrice,
    uint256 quotePrice,
    uint256 ratio,
    uint256 blockTimestamp
);
```

## Indexer Schema Updates

### Add Pyth Price Tables
```typescript
// Price feed updates from Pyth
export const PythPriceUpdate = onchainTable("PythPriceUpdate", (t) => ({
  id: t.text().primaryKey(), // tx_hash + log_index
  token: t.text().notNull(), // "ETH" or "BTC"
  priceId: t.text().notNull(), // Pyth price feed ID
  price: t.bigint().notNull(), // Raw price from Pyth
  confidence: t.bigint().notNull(), // Confidence interval
  publishTime: t.integer().notNull(), // When price was published
  blockTimestamp: t.integer().notNull(), // When update hit chain
  blockNumber: t.bigint().notNull(),
  updater: t.text().notNull(), // Who pushed the update
  txHash: t.text().notNull(),
}));

// Calculated ratios from price updates
export const RatioUpdate = onchainTable("RatioUpdate", (t) => ({
  id: t.text().primaryKey(), // tx_hash + log_index
  baseToken: t.text().notNull(), // "ETH"
  quoteToken: t.text().notNull(), // "BTC"
  basePrice: t.bigint().notNull(), // ETH price
  quotePrice: t.bigint().notNull(), // BTC price
  ratio: t.bigint().notNull(), // ETH share (scaled by 1e18)
  blockTimestamp: t.integer().notNull(),
  blockNumber: t.bigint().notNull(),
  txHash: t.text().notNull(),
}));
```

## Event Handlers

### 1. Index RatioOracle Price Updates
```typescript
ponder.on("RatioOracle:PricesUpdated", async ({ event, context }) => {
  // Record that prices were updated
  await context.db.insert(PriceUpdate).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    timestamp: Number(event.args.timestamp),
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
    updater: event.transaction.from,
  });
  
  // Trigger market share recalculation
  await updateMarketShares(context, event.block);
});
```

### 2. Index Pyth Contract Directly (Advanced)
```typescript
// Add Pyth contract to ponder.config.ts
export default createConfig({
  contracts: {
    PythOracle: {
      abi: PythAbi,
      address: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
      startBlock: 170000000, // Recent block
      network: "arbitrum",
    },
    // ... other contracts
  },
});

// Handler for Pyth price feed updates
ponder.on("PythOracle:PriceFeedUpdate", async ({ event, context }) => {
  const { id, publishTime, price, conf } = event.args;
  
  // Only track ETH and BTC price feeds
  const ethPriceId = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
  const btcPriceId = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
  
  let token: string | null = null;
  if (id === ethPriceId) token = "ETH";
  if (id === btcPriceId) token = "BTC";
  
  if (!token) return; // Ignore other price feeds
  
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
  
  // Calculate new ratios if we have both prices
  await calculateAndStoreRatios(context, event.block);
});
```

### 3. Calculate Ratios from Price Updates
```typescript
async function calculateAndStoreRatios(context: any, block: any) {
  // Get latest prices for both tokens
  const latestEthPrice = await context.db.PythPriceUpdate.findFirst({
    where: { token: "ETH" },
    orderBy: { blockTimestamp: "desc" },
  });
  
  const latestBtcPrice = await context.db.PythPriceUpdate.findFirst({
    where: { token: "BTC" },
    orderBy: { blockTimestamp: "desc" },
  });
  
  if (!latestEthPrice || !latestBtcPrice) return;
  
  // Calculate ratio (ETH share)
  const ethPrice = latestEthPrice.price;
  const btcPrice = latestBtcPrice.price;
  const totalValue = ethPrice + btcPrice;
  
  if (totalValue === 0n) return;
  
  const ratio = (ethPrice * 10n**18n) / totalValue;
  
  await context.db.insert(RatioUpdate).values({
    id: `ratio-${block.timestamp}`,
    baseToken: "ETH",
    quoteToken: "BTC",
    basePrice: ethPrice,
    quotePrice: btcPrice,
    ratio,
    blockTimestamp: Number(block.timestamp),
    blockNumber: block.number,
    txHash: "0x0", // System calculated
  });
  
  // Update market shares with new ratios
  await updateMarketSharesWithRatio(context, block, ratio);
}
```

## Price Update Sources

### Who Updates Pyth Prices on Arbitrum?
1. **GMX Protocol** - Major derivatives platform
2. **Gains Network** - Perpetual trading protocol  
3. **Arbitrageurs** - MEV bots capturing price differences
4. **Market makers** - Professional trading firms
5. **Your protocol** - When you need fresh prices

### Monitoring Price Updates
```typescript
// Query recent price updates
const recentUpdates = await context.db.PythPriceUpdate.findMany({
  where: {
    blockTimestamp_gte: Math.floor(Date.now() / 1000) - 3600 // Last hour
  },
  orderBy: { blockTimestamp: "desc" },
  limit: 100,
});

// Check update frequency
const ethUpdates = recentUpdates.filter(u => u.token === "ETH");
const btcUpdates = recentUpdates.filter(u => u.token === "BTC");

console.log(`ETH updates in last hour: ${ethUpdates.length}`);
console.log(`BTC updates in last hour: ${btcUpdates.length}`);
```

## Frontend GraphQL Queries

### Get Latest Prices and Ratios
```graphql
query GetLatestPrices {
  pythPriceUpdates(
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 2
  ) {
    items {
      token
      price
      confidence
      publishTime
      blockTimestamp
      updater
    }
  }
  
  ratioUpdates(
    orderBy: "blockTimestamp"
    orderDirection: "desc"
    limit: 1
  ) {
    items {
      baseToken
      quoteToken
      ratio
      blockTimestamp
    }
  }
}
```

### Get Price History for Charts
```graphql
query GetPriceHistory($from: Int!, $to: Int!) {
  ratioUpdates(
    where: {
      blockTimestamp_gte: $from
      blockTimestamp_lte: $to
    }
    orderBy: "blockTimestamp"
    orderDirection: "asc"
  ) {
    items {
      ratio
      blockTimestamp
      basePrice
      quotePrice
    }
  }
}
```

## Implementation Priority

### Phase 1: Basic Price Tracking
1. ✅ Index `RatioOracle:PricesUpdated` events
2. ✅ Track when prices are updated
3. ✅ Update market shares accordingly

### Phase 2: Detailed Price Data
1. Index Pyth contract directly
2. Track individual token price updates
3. Calculate ratios from raw price data

### Phase 3: Advanced Analytics
1. Track update frequency and patterns
2. Monitor staleness and confidence intervals
3. Identify major price updaters

## Notes

- **ETH/BTC prices update frequently** (every few minutes during active trading)
- **You don't need to run a keeper** - other protocols already do this
- **Your indexer should track these updates** to provide real-time data
- **Frontend gets live data** from your indexed price updates
- **For demo**: Show how ratios change with real market movements