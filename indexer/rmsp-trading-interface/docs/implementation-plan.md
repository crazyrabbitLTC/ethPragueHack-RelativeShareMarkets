# Trading Interface Implementation Plan

## Project Overview

This document outlines the plan for integrating the RMSP (Relative Share Markets Protocol) trading interface with the Ponder indexer and implementing TradingView charts.

### Current State

- **Indexer**: Running on `http://localhost:42070/` with GraphQL endpoint
- **Interface**: Next.js app using v0.dev components with mock data
- **Stack**: Next.js 15, React 19, Tailwind CSS, Radix UI components

## Indexer GraphQL Schema

### Available Entities

The indexer provides the following GraphQL entities:

1. **Position**
   - `id`: Unique identifier
   - `user`: User address
   - `baseToken`: Base token address
   - `quoteToken`: Quote token address
   - `notional`: Position size
   - `isLong`: Boolean for position direction
   - `entryShare`: Entry share price
   - `exitShare`: Exit share price (nullable)
   - `requiredMargin`: Required margin amount
   - `pnl`: Profit/Loss (nullable)
   - `status`: Position status
   - `openedAt`: Opening timestamp
   - `closedAt`: Closing timestamp (nullable)
   - `openTxHash`: Opening transaction hash
   - `closeTxHash`: Closing transaction hash (nullable)
   - `openBlockNumber`: Opening block number
   - `closeBlockNumber`: Closing block number (nullable)

2. **PriceUpdate**
   - `id`: Unique identifier
   - `timestamp`: Update timestamp
   - `blockNumber`: Block number
   - `txHash`: Transaction hash
   - `updater`: Address that updated the price

3. **User**
   - User account information

4. **Deposit/Withdrawal**
   - Transaction history

5. **ProtocolStats**
   - Overall protocol statistics

### Query Endpoints

- `position(id)` / `positions()` - Fetch positions
- `priceUpdate(id)` / `priceUpdates()` - Fetch price updates
- `user(id)` / `users()` - Fetch user data
- `protocolStats()` / `protocolStatss()` - Fetch protocol statistics

## Current Interface Structure

### Components
- **HeaderBar**: Shows block number and connection status
- **BasketChips**: Displays token basket info and PnL
- **ChartPlaceholder**: Placeholder for price chart
- **ShareTable**: Shows token weights and performance
- **OrderForm**: Form for placing orders
- **PositionCard**: Displays user position details
- **TradingPairSelector**: Dropdown for selecting trading pairs
- **ToastStack**: Notification system

### Mock Data Structure
```typescript
// Token type
{
  symbol: string;
  weight: number;
  currentShare: number;
  change24h: number;
  volatility: number;
}

// Position type
{
  side: "long" | "short";
  entryShare: number;
  currentShare: number;
  pnlUsd: number;
  pnlPercent: number;
  margin: number;
  liquidationDistance: number;
  notional: number;
}
```

## Implementation Plan

### Phase 1: Initial Setup & GraphQL Integration

#### 1.1 Install Dependencies
```bash
cd indexer/rmsp-trading-interface
pnpm install @apollo/client graphql
# or
pnpm install urql graphql
```

#### 1.2 Create GraphQL Client
Create `lib/graphql/client.ts`:
```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';

export const client = new ApolloClient({
  uri: 'http://localhost:42070/',
  cache: new InMemoryCache(),
});
```

#### 1.3 Define Queries
Create `lib/graphql/queries.ts` with all necessary queries.

### Phase 2: Data Integration

#### 2.1 Type Alignment
- Update component types to match indexer schema
- Create type mapping utilities for data transformation

#### 2.2 Component Updates

**PositionCard Integration**:
- Query user positions filtered by wallet address
- Calculate real-time PnL based on current share prices
- Handle position status (open/closed)

**ShareTable Integration**:
- Aggregate price data to calculate token shares
- Compute 24h changes from historical data
- Calculate volatility metrics

**HeaderBar Integration**:
- Query latest block number from recent transactions
- Show real connection status

**BasketChips Integration**:
- Calculate total PnL across all positions
- Show real token composition

### Phase 3: TradingView Integration

#### 3.1 Install TradingView Library
```bash
pnpm install lightweight-charts
# or use advanced charts if available
```

#### 3.2 Create Data Feed Adapter
Implement `lib/tradingview/datafeed.ts`:
- Convert price updates to OHLCV format
- Implement historical data fetching
- Set up real-time price subscriptions

#### 3.3 Replace ChartPlaceholder
- Create new Chart component with TradingView
- Implement time frame selection
- Add technical indicators

### Phase 4: Real-time Updates

#### 4.1 GraphQL Subscriptions
- Set up WebSocket connection for real-time data
- Implement subscription queries for:
  - Position updates
  - Price updates
  - New trades

#### 4.2 Optimistic Updates
- Implement optimistic UI updates for orders
- Handle rollback on transaction failure

### Phase 5: Smart Contract Integration

#### 5.1 Wallet Connection
- Integrate wallet connection (using existing header functionality)
- Filter data by connected wallet address

#### 5.2 Order Submission
- Connect OrderForm to smart contract calls
- Handle transaction lifecycle
- Update UI on transaction confirmation

## Technical Considerations

### Data Transformation
- Need to convert BigInt values from indexer to numbers for UI
- Handle null values appropriately
- Format addresses for display

### Caching Strategy
- Use Apollo Cache or React Query for efficient data management
- Implement cache invalidation on updates
- Consider pagination for large datasets

### Error Handling
- Implement comprehensive error boundaries
- Handle network failures gracefully
- Provide user-friendly error messages

### Performance
- Implement lazy loading for historical data
- Use GraphQL fragments to minimize data transfer
- Consider implementing virtual scrolling for large lists

### TradingView Specific
- Need to aggregate tick data into candles
- Handle gaps in price data
- Implement proper timezone handling
- Consider data resolution (1m, 5m, 1h, etc.)

## File Structure

```
indexer/rmsp-trading-interface/
├── lib/
│   ├── graphql/
│   │   ├── client.ts           # Apollo/urql client setup
│   │   ├── queries.ts          # All GraphQL queries
│   │   ├── subscriptions.ts    # Real-time subscriptions
│   │   ├── fragments.ts        # Reusable GraphQL fragments
│   │   └── types.ts            # Generated TypeScript types
│   ├── hooks/
│   │   ├── usePositions.ts     # Position data hooks
│   │   ├── usePrices.ts        # Price data hooks
│   │   ├── useProtocol.ts      # Protocol stats hooks
│   │   ├── useWallet.ts        # Wallet connection hooks
│   │   └── useOrders.ts        # Order submission hooks
│   ├── tradingview/
│   │   ├── datafeed.ts         # TradingView data adapter
│   │   ├── indicators.ts       # Custom indicators
│   │   └── utils.ts            # Chart utilities
│   └── utils/
│       ├── formatters.ts       # Data formatting utilities
│       ├── calculations.ts     # PnL and share calculations
│       └── constants.ts        # App constants
├── components/
│   └── chart/
│       └── TradingViewChart.tsx # New chart component
```

## Next Steps

1. Get the interface running locally
2. Set up GraphQL client and test connection
3. Create first query hook (positions)
4. Update PositionCard with real data
5. Continue with other components
6. Implement TradingView chart
7. Add real-time updates
8. Integrate smart contract calls

## Resources

- [Ponder Documentation](https://ponder.sh)
- [Apollo Client Docs](https://www.apollographql.com/docs/react/)
- [TradingView Charting Library](https://www.tradingview.com/charting-library-docs/)
- [Next.js 15 Documentation](https://nextjs.org/docs) 