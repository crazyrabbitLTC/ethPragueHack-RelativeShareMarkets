# Trading Interface Documentation

This folder contains comprehensive documentation for the RMSP Trading Interface implementation.

## Documentation Index

### 📋 [Implementation Plan](./implementation-plan.md)
Detailed step-by-step plan for:
- Connecting the interface to the Ponder indexer
- Implementing TradingView charts
- GraphQL integration strategy
- Component update roadmap
- Technical architecture decisions

### 🎯 [Project Context](./project-context.md)
Background information including:
- Project overview and goals
- Current implementation status
- Architecture decisions
- Development workflow
- Known constraints and considerations

### 🔍 [GraphQL Queries Reference](./graphql-queries-reference.md)
Complete reference for:
- Example queries for all entities
- Query patterns and parameters
- Type conversion utilities
- GraphQL fragments for reusability

### 📋 [Indexer Data Requirements](./indexer-data-requirements.md)
Comprehensive list of data needed from the indexer

## Quick Start

1. **Review the context** - Start with `project-context.md` to understand the current state
2. **Follow the plan** - Use `implementation-plan.md` as your guide
3. **Reference queries** - Copy queries from `graphql-queries-reference.md` as needed

## Key Information

- **Indexer URL**: `http://localhost:42070/`
- **Tech Stack**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Current State**: UI built with mock data, ready for integration

## Progress Update (As of latest commit)

### ✅ Completed
- GraphQL integration with Apollo Client
- Successfully fetching real positions from indexer
- Real-time block number updates from blockchain
- Position data transformation for UI
- Error handling and loading states

### 🚧 In Progress
- Decimal conversion for proper value display
- TradingView chart integration
- Real-time price updates

### 📋 Next Steps

1. ~~Install dependencies and run the interface~~ ✅
2. ~~Set up GraphQL client (Apollo or urql)~~ ✅
3. ~~Start replacing mock data with real queries~~ ✅ (Partial)
4. Implement TradingView charts
5. Add real-time updates
6. Complete smart contract integration

## Running the Interface

```bash
cd indexer/rmsp-trading-interface
npm install --legacy-peer-deps
npm run dev
```

The interface will be available at `http://localhost:3000` 

## Quick Links

- Frontend: http://localhost:3000
- Ponder Indexer: http://localhost:42070
- GraphQL Playground: http://localhost:42070/graphql

## Key Features

- Real-time blockchain data integration via Ponder indexer
- TradingView charts for visualizing relative market shares
- Position management with P&L tracking
- Multi-token basket trading interface 