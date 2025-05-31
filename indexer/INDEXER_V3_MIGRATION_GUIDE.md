# Indexer Migration Guide: SimplePerpV2 to SimplePerpV3

## Overview
The indexer needs to be updated from SimplePerpV2 to SimplePerpV3 to support multi-token baskets instead of binary token pairs. SimplePerpV3 supports positions with up to 8 tokens, while V2 only supported binary ETH/BTC positions.

## Key Contract Changes

### SimplePerpV3 Address
- Contract: `SimplePerpV3.sol` or `SimplePerpV3Enhanced.sol` 
- Location: `/contracts/src/SimplePerpV3.sol`
- Deployment info: Check `/contracts/deployments/arbitrum.json`

### Major Differences from V2
1. **Multi-token support**: Positions now have arrays of token exposures instead of binary long/short
2. **Vector-based exposures**: Each position tracks exposure to multiple tokens simultaneously
3. **Enhanced events**: More detailed event emissions for better tracking

## Events to Index

### Primary Events from SimplePerpV3Enhanced

1. **TradeExecuted**
```solidity
event TradeExecuted(
    address indexed trader,
    uint256 indexed positionId,
    uint256[] tokenIds,        // Array of token IDs in the trade
    int256[] exposureDeltas,    // Exposure change for each token
    uint256 entryRatio,         // Entry ratio (scaled by 1e18)
    uint256 totalNotional       // Total notional value
);
```

2. **ExposureUpdated**
```solidity
event ExposureUpdated(
    address indexed trader,
    uint256 indexed tokenId,
    int256 oldExposure,
    int256 newExposure
);
```

3. **PositionClosed**
```solidity
event PositionClosed(
    address indexed trader,
    uint256 indexed positionId,
    int256 pnl,
    uint256 closingRatio
);
```

4. **NetExposureUpdated**
```solidity
event NetExposureUpdated(
    uint256 indexed tokenId,
    int256 oldNetExposure,
    int256 newNetExposure
);
```

5. **MarginUpdated**
```solidity
event MarginUpdated(
    address indexed trader,
    uint256 indexed positionId,
    int256 marginDelta,
    uint256 newMargin
);
```

## Schema Updates Required

### 1. Update Position Entity
Current schema assumes binary positions. Update to support multi-token:

```typescript
// Current (V2)
type Position @entity {
  baseToken: String!
  quoteToken: String!
  // ...
}

// Needed (V3)
type Position @entity {
  tokenIds: [BigInt!]!      // Array of token IDs
  exposures: [BigInt!]!     // Array of exposures (scaled by 1e18)
  symbols: [String!]!       // Array of token symbols
  // ...
}
```

### 2. Add PositionUpdate Records
Generate time-series data for the chart:

```typescript
type PositionUpdate @entity {
  id: String!
  position: Position!
  timestamp: BigInt!
  blockNumber: BigInt!
  tokenSymbol: String!      // Which token in the basket
  currentShare: BigInt!     // Current percentage (scaled by 1e18)
  exposure: BigInt!         // Raw exposure value
}
```

### 3. Add MarketShare Entity
For aggregate market-wide shares:

```typescript
type MarketShare @entity {
  id: String!               // Format: "tokenSymbol-timestamp"
  tokenSymbol: String!
  timestamp: BigInt!
  aggregateShare: BigInt!   // Total market share percentage (scaled by 1e18)
  positionCount: BigInt!
  totalVolume: BigInt!
}
```

## Implementation Steps

### 1. Update Contract References
```typescript
// In ponder.config.ts
export default createConfig({
  contracts: {
    SimplePerpV3: {
      abi: SimplePerpV3Abi,  // Update ABI import
      address: "0x...",      // Get from deployments/arbitrum.json
      startBlock: ...,       // Get deployment block
    },
    // Keep RatioOracle and TokenRegistry
  },
});
```

### 2. Update Event Handlers

Example for TradeExecuted:
```typescript
ponder.on("SimplePerpV3:TradeExecuted", async ({ event, context }) => {
  const { trader, positionId, tokenIds, exposureDeltas, entryRatio, totalNotional } = event.args;
  
  // Create or update position with multi-token data
  await context.db.Position.upsert({
    id: positionId.toString(),
    create: {
      trader,
      tokenIds: tokenIds.map(id => id.toString()),
      exposures: exposureDeltas.map(exp => exp.toString()),
      entryRatio: entryRatio.toString(),
      totalNotional: totalNotional.toString(),
      timestamp: BigInt(event.block.timestamp),
      // Map token IDs to symbols using TokenRegistry
    },
    update: {
      // Update logic for existing positions
    },
  });
  
  // Generate PositionUpdate records for each token
  for (let i = 0; i < tokenIds.length; i++) {
    if (exposureDeltas[i] !== 0n) {
      await createPositionUpdate(context, positionId, tokenIds[i], exposureDeltas[i], event);
    }
  }
});
```

### 3. Calculate Relative Shares
Since RatioOracle only supports binary ratios currently, calculate multi-token shares in the indexer:

```typescript
async function calculateRelativeShares(exposures: bigint[], prices: bigint[]): Promise<bigint[]> {
  // Calculate total value across all tokens
  let totalValue = 0n;
  const values = exposures.map((exp, i) => {
    const value = (exp * prices[i]) / 10n**18n;
    totalValue += value;
    return value;
  });
  
  // Calculate percentage shares
  if (totalValue === 0n) return exposures.map(() => 0n);
  
  return values.map(value => (value * 10n**18n) / totalValue);
}
```

### 4. Generate Time-Series Data
Create a periodic task or use block handlers to generate PositionUpdate records:

```typescript
// In a block handler or periodic task
async function generateMarketShares(context: Context, block: Block) {
  // Aggregate all positions to calculate market-wide shares
  const positions = await context.db.Position.findMany({
    where: { isActive: true }
  });
  
  // Calculate aggregate shares per token
  const tokenShares = new Map<string, bigint>();
  
  for (const position of positions) {
    // Add position's contribution to each token's market share
    // ...
  }
  
  // Store MarketShare records
  for (const [tokenSymbol, share] of tokenShares) {
    await context.db.MarketShare.create({
      id: `${tokenSymbol}-${block.timestamp}`,
      tokenSymbol,
      timestamp: BigInt(block.timestamp),
      aggregateShare: share,
      // ...
    });
  }
}
```

## Token Registry Integration

Use the TokenRegistry contract to map token IDs to symbols:

```typescript
// Cache token metadata
const tokenCache = new Map<number, TokenInfo>();

async function getTokenInfo(tokenId: number): Promise<TokenInfo> {
  if (tokenCache.has(tokenId)) return tokenCache.get(tokenId)!;
  
  // Fetch from TokenRegistry contract
  const token = await tokenRegistry.getToken(tokenId);
  const info = {
    symbol: token.symbol,
    decimals: token.decimals,
    riskWeight: token.riskWeight,
  };
  
  tokenCache.set(tokenId, info);
  return info;
}
```

## Oracle Price Integration

Until RatioOracle supports multi-token shares, fetch prices directly:

```typescript
// Get prices for share calculations
async function getTokenPrices(tokenSymbols: string[]): Promise<bigint[]> {
  const prices: bigint[] = [];
  
  for (const symbol of tokenSymbols) {
    try {
      const price = await ratioOracle.getPrice(symbol);
      prices.push(BigInt(price));
    } catch {
      // Handle missing price feeds
      prices.push(0n);
    }
  }
  
  return prices;
}
```

## Testing the Migration

1. **Deploy V3 contracts** to a test environment if not already deployed
2. **Generate test trades** with multiple tokens using scripts
3. **Verify event emissions** match expected format
4. **Test GraphQL queries** return multi-token data correctly

## GraphQL Query Examples

### Get Market Shares for Chart
```graphql
query GetMarketShares($from: String!, $to: String!) {
  marketShares(
    where: { 
      timestamp_gte: $from,
      timestamp_lte: $to 
    },
    orderBy: "timestamp",
    orderDirection: "asc"
  ) {
    items {
      tokenSymbol
      timestamp
      aggregateShare
    }
  }
}
```

### Get Position with Multi-Token Data
```graphql
query GetPosition($id: String!) {
  position(id: $id) {
    tokenIds
    exposures
    symbols
    trader
    totalNotional
  }
}
```

## Notes

- SimplePerpV3 is already deployed and supports multi-token positions
- The main limitation is RatioOracle only calculating binary ratios
- Generate relative shares in the indexer until oracle is upgraded
- All percentage values should be BigInt scaled by 10^18
- Consider batch processing for efficiency with many positions