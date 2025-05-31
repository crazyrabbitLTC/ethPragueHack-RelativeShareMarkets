# Project Context

## Overview

This trading interface is part of the RMSP (Relative Share Markets Protocol) system built during ETHPrague hackathon. It provides a UI for trading relative share positions between different tokens.

## Architecture

### Backend Infrastructure
- **Smart Contracts**: Deployed contracts handle position management, pricing, and settlements
- **Ponder Indexer**: Indexes blockchain events and provides GraphQL API at `http://localhost:42070/`
- **Database**: Ponder uses internal database for storing indexed data

### Frontend Stack
- **Framework**: Next.js 15 with App Router
- **UI Library**: Radix UI components with Tailwind CSS
- **State Management**: Currently using React hooks and local state
- **Data Fetching**: To be implemented with GraphQL client

## Current Implementation Status

### ✅ Completed
- Basic UI components created with v0.dev
- Mock data structure defined
- Component layout and styling
- Notification system (toasts)

### 🚧 In Progress
- GraphQL integration
- Real data fetching from indexer
- TradingView chart implementation

### ❌ Not Started
- Wallet connection integration
- Smart contract interactions
- Real-time data updates
- Order submission functionality

## Key Design Decisions

1. **Component-First Approach**: Built UI components first with mock data to establish design patterns
2. **Type Safety**: Using TypeScript throughout for better developer experience
3. **Modular Architecture**: Each component is self-contained with clear interfaces
4. **Real-time Ready**: Architecture supports future WebSocket/subscription integration

## Data Flow

```
Blockchain Events
    ↓
Ponder Indexer
    ↓
GraphQL API (localhost:42070)
    ↓
Apollo/urql Client
    ↓
React Hooks
    ↓
UI Components
```

## Development Workflow

1. **Indexer**: Must be running (`cd indexer && pnpm dev`)
2. **Interface**: Run separately (`cd indexer/rmsp-trading-interface && pnpm dev`)
3. **Testing**: Use GraphQL playground at `http://localhost:42070/`

## Environment Setup

No environment variables are currently required, but future additions will include:
- Wallet connection providers
- Smart contract addresses
- WebSocket endpoints
- API keys for external services

## Known Constraints

1. **Monorepo Structure**: This is part of a larger monorepo - changes should be isolated to this package
2. **Mock to Real Data**: Need careful mapping between mock data structure and actual GraphQL schema
3. **BigInt Handling**: GraphQL returns BigInt values that need conversion for UI display
4. **Price Aggregation**: No direct price feed - need to calculate from position/share data

## Testing Strategy

- Unit tests for utility functions
- Integration tests for GraphQL queries
- E2E tests for critical user flows
- Manual testing with local indexer

## Security Considerations

- All sensitive operations will require wallet signatures
- No private keys or sensitive data stored client-side
- Validate all user inputs before contract calls
- Use checksummed addresses throughout 