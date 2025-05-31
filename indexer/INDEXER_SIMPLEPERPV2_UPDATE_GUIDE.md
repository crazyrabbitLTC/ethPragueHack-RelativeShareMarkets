# SimplePerpV2 Indexer Update Guide

## Overview
This guide explains how to update the indexer to properly work with SimplePerpV2 for the hackathon demo. We're focusing on ETH/BTC binary positions only, which simplifies the implementation significantly.

## Current Deployment Information

### Deployed Contracts
- **SimplePerpV2**: `0x99d45f0d21D135D0947F641Ae4C10E00DF820244`
- **RatioOracle**: `0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f`
- **MockUSDC**: `0xe2696990894452AbE9ce45ba557979c2cbc6B3dd`
- **Network**: Arbitrum Mainnet (Chain ID: 42161)

### Oracle Configuration
- Currently using **mock prices** (useMockPrices = true)
- Will switch to **Pyth oracle** for live demo
- Pyth contract on Arbitrum: `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C`

## SimplePerpV2 Events to Index

### 1. **PositionOpened**
```solidity
event PositionOpened(
    address indexed trader,
    uint256 indexed positionId,
    uint256 notional,
    bool isLong,
    uint256 leverage,
    uint256 entryRatio,
    uint256 margin
);
```

### 2. **PositionClosed**
```solidity
event PositionClosed(
    address indexed trader,
    uint256 indexed positionId,
    int256 pnl,
    uint256 exitRatio
);
```

### 3. **PositionUpdated**
```solidity
event PositionUpdated(
    address indexed trader,
    uint256 indexed positionId,
    int256 pnl,
    uint256 currentRatio
);
```

### 4. **Deposit**
```solidity
event Deposit(
    address indexed user,
    uint256 amount,
    uint256 timestamp
);
```

### 5. **Withdrawal**
```solidity
event Withdrawal(
    address indexed user,
    uint256 amount,
    uint256 timestamp
);
```

## Required Schema Updates

### 1. **Position Entity**
```typescript
type Position @entity {
  id: String!                    # positionId
  trader: Bytes!                 # trader address
  baseToken: String!             # "ETH"
  quoteToken: String!            # "BTC"
  notional: BigInt!              # position size
  margin: BigInt!                # collateral amount
  isLong: Boolean!               # true = long ETH/short BTC
  leverage: BigInt!              # leverage factor
  entryRatio: BigInt!            # ETH/BTC ratio at entry
  entryShares: BigInt!           # ETH percentage at entry (scaled by 1e18)
  exitShares: BigInt             # ETH percentage at exit (if closed)
  pnl: BigInt                    # realized P&L (if closed)
  status: String!                # "open" or "closed"
  openedAt: BigInt!              # block timestamp
  closedAt: BigInt               # block timestamp (if closed)
  lastUpdated: BigInt!           # last update timestamp
}
```

### 2. **PositionUpdate Entity**
```typescript
type PositionUpdate @entity {
  id: String!                    # positionId-blockNumber
  position: Position!            # reference to position
  timestamp: BigInt!             # block timestamp
  blockNumber: BigInt!           # block number
  currentRatio: BigInt!          # current ETH/BTC ratio
  currentShares: BigInt!         # current ETH percentage (scaled by 1e18)
  pnl: BigInt!                   # unrealized P&L at this point
}
```

### 3. **MarketShare Entity** (for chart data)
```typescript
type MarketShare @entity {
  id: String!                    # "ETH-timestamp" or "BTC-timestamp"
  tokenSymbol: String!           # "ETH" or "BTC"
  timestamp: BigInt!             # block timestamp
  aggregateShare: BigInt!        # total market share (scaled by 1e18)
  positionCount: BigInt!         # number of positions
  totalLongExposure: BigInt!     # total long exposure
  totalShortExposure: BigInt!    # total short exposure
}
```

## Implementation Guide

### 1. **Update ponder.config.ts**
```typescript
import { SimplePerpV2Abi } from "../abis/SimplePerpV2Abi";

export default createConfig({
  contracts: {
    SimplePerpV2: {
      abi: SimplePerpV2Abi,
      address: "0x99d45f0d21D135D0947F641Ae4C10E00DF820244",
      startBlock: 123456789, // Get from deployment transaction
      network: "arbitrum",
    },
    RatioOracle: {
      abi: RatioOracleAbi,
      address: "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f",
      startBlock: 123456789, // Get from deployment transaction
      network: "arbitrum",
    },
  },
});
```

### 2. **Handle PositionOpened Event**
```typescript
ponder.on("SimplePerpV2:PositionOpened", async ({ event, context }) => {
  const { trader, positionId, notional, isLong, leverage, entryRatio, margin } = event.args;
  
  // Calculate entry shares (ETH percentage)
  const entryShares = entryRatio; // Already represents ETH share
  
  await context.db.Position.create({
    id: positionId.toString(),
    data: {
      trader,
      baseToken: "ETH",
      quoteToken: "BTC",
      notional: notional.toString(),
      margin: margin.toString(),
      isLong,
      leverage: leverage.toString(),
      entryRatio: entryRatio.toString(),
      entryShares: entryShares.toString(),
      status: "open",
      openedAt: BigInt(event.block.timestamp),
      lastUpdated: BigInt(event.block.timestamp),
    },
  });
  
  // Create initial position update
  await context.db.PositionUpdate.create({
    id: `${positionId}-${event.block.number}`,
    data: {
      position: positionId.toString(),
      timestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
      currentRatio: entryRatio.toString(),
      currentShares: entryShares.toString(),
      pnl: "0",
    },
  });
});
```

### 3. **Generate Market Share Data**
```typescript
// In a block handler or periodic aggregation
async function updateMarketShares(context: Context, block: Block) {
  const positions = await context.db.Position.findMany({
    where: { status: "open" }
  });
  
  let totalETHLong = 0n;
  let totalBTCLong = 0n;
  
  for (const position of positions) {
    if (position.isLong) {
      totalETHLong += BigInt(position.notional);
    } else {
      totalBTCLong += BigInt(position.notional);
    }
  }
  
  const total = totalETHLong + totalBTCLong;
  if (total === 0n) return;
  
  // Calculate shares
  const ethShare = (totalETHLong * 10n**18n) / total;
  const btcShare = 10n**18n - ethShare; // Ensure they sum to 100%
  
  // Store ETH market share
  await context.db.MarketShare.create({
    id: `ETH-${block.timestamp}`,
    data: {
      tokenSymbol: "ETH",
      timestamp: BigInt(block.timestamp),
      aggregateShare: ethShare.toString(),
      positionCount: BigInt(positions.length),
      totalLongExposure: totalETHLong.toString(),
      totalShortExposure: "0",
    },
  });
  
  // Store BTC market share
  await context.db.MarketShare.create({
    id: `BTC-${block.timestamp}`,
    data: {
      tokenSymbol: "BTC",
      timestamp: BigInt(block.timestamp),
      aggregateShare: btcShare.toString(),
      positionCount: BigInt(positions.length),
      totalLongExposure: totalBTCLong.toString(),
      totalShortExposure: "0",
    },
  });
}
```

### 4. **Price Integration Notes**

For the hackathon demo:
1. **Development**: Keep using mock prices in RatioOracle
2. **Demo**: Switch to Pyth oracle for real ETH/BTC prices
3. **Price Updates**: Can be triggered by frontend or a simple keeper script

```typescript
// Example: Get current ratio from oracle
async function getCurrentRatio() {
  try {
    // This will use either mock or Pyth prices based on oracle config
    const ratio = await ratioOracle.getRatioShare("ETH", "BTC");
    return ratio;
  } catch (error) {
    console.error("Failed to get ratio:", error);
    // Fallback to last known ratio
    return lastKnownRatio;
  }
}
```

## GraphQL Queries for Frontend

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

### Get User Positions
```graphql
query GetUserPositions($trader: String!) {
  positions(
    where: { 
      trader: $trader,
      status: "open"
    }
  ) {
    items {
      id
      baseToken
      quoteToken
      notional
      margin
      isLong
      entryShares
      pnl
      lastUpdated
    }
  }
}
```

## Testing Approach

1. **Use Mock Prices for Development**:
   ```javascript
   // Set realistic mock prices
   await ratioOracle.setPrice("ETH", "3500000000000000000000"); // $3,500
   await ratioOracle.setPrice("BTC", "95000000000000000000000"); // $95,000
   ```

2. **Generate Test Data**:
   - Create positions with various long/short biases
   - Simulate price movements
   - Generate position updates over time

3. **Switch to Pyth for Demo**:
   ```javascript
   await ratioOracle.setPythOracle("0xff1a0f4744e8582DF1aE09D5611b887B6a12925C");
   ```

## Key Simplifications for Hackathon

1. **Binary Positions Only**: ETH vs BTC (no multi-token complexity)
2. **Simple Share Calculation**: ETH percentage = entryRatio, BTC percentage = 1 - entryRatio
3. **Mock Prices OK**: Use realistic values for demo
4. **No Historical Backfill**: Start fresh with new data
5. **Basic Aggregation**: Simple market share calculations

## Notes

- SimplePerpV2 is already deployed and working
- Focus on getting clean ETH/BTC percentage data to frontend
- Multi-token support can be shown as "future roadmap"
- Keep the implementation simple and demo-ready