import { gql } from '@apollo/client';

// Fragment for common position fields
export const POSITION_FRAGMENT = gql`
  fragment PositionDetails on Position {
    id
    trader
    baseToken
    quoteToken
    notional
    margin
    isLong
    leverage
    entryRatio
    entryShares
    exitShares
    pnl
    status
    openedAt
    closedAt
    lastUpdated
    openTxHash
    closeTxHash
    openBlockNumber
    closeBlockNumber
  }
`;

// Get positions for a specific user
export const GET_USER_POSITIONS = gql`
  ${POSITION_FRAGMENT}
  query GetUserPositions($userAddress: String!) {
    positions(
      where: { trader: $userAddress }
      orderBy: "openedAt"
      orderDirection: "desc"
    ) {
      items {
        ...PositionDetails
      }
    }
  }
`;

// Get all positions - simplified for Ponder
export const GET_ALL_POSITIONS = gql`
  ${POSITION_FRAGMENT}
  query GetAllPositions($limit: Int) {
    positions(limit: $limit, orderBy: "openedAt", orderDirection: "desc") {
      items {
        ...PositionDetails
      }
    }
  }
`;

// Get market shares for chart data
export const GET_MARKET_SHARES = gql`
  query GetMarketShares($from: Int, $to: Int, $limit: Int, $tokenSymbol: String) {
    marketShares(
      where: { 
        timestamp_gte: $from
        timestamp_lte: $to
        tokenSymbol: $tokenSymbol
      }
      orderBy: "timestamp"
      orderDirection: "asc"
      limit: $limit
    ) {
      items {
        id
        tokenSymbol
        timestamp
        blockNumber
        aggregateShare
        positionCount
        totalLongExposure
        totalShortExposure
      }
    }
  }
`;

// Get all market shares (for multi-token chart)
export const GET_ALL_MARKET_SHARES = gql`
  query GetAllMarketShares($from: Int, $to: Int, $limit: Int) {
    marketShares(
      where: { 
        timestamp_gte: $from
        timestamp_lte: $to
      }
      orderBy: "timestamp"
      orderDirection: "asc"
      limit: $limit
    ) {
      items {
        id
        tokenSymbol
        timestamp
        blockNumber
        aggregateShare
        positionCount
        totalLongExposure
        totalShortExposure
      }
    }
  }
`;

// Get position updates for time-series data
export const GET_POSITION_UPDATES = gql`
  query GetPositionUpdates($limit: Int, $trader: String, $from: Int, $to: Int) {
    positionUpdates(
      where: {
        trader: $trader
        timestamp_gte: $from
        timestamp_lte: $to
      }
      limit: $limit
      orderBy: "timestamp"
      orderDirection: "asc"
    ) {
      items {
        id
        trader
        positionId
        timestamp
        blockNumber
        currentRatio
        currentShares
        unrealizedPnl
        txHash
      }
    }
  }
`;

// Get latest price updates
export const GET_LATEST_PRICES = gql`
  query GetLatestPrices($limit: Int!) {
    priceUpdates(limit: $limit, orderBy: "timestamp", orderDirection: "desc") {
      items {
        id
        timestamp
        blockNumber
        txHash
        updater
      }
    }
  }
`;

// Get protocol statistics
export const GET_PROTOCOL_STATS = gql`
  query GetProtocolStats {
    protocolStats {
      items {
        id
        totalDeposits
        totalOpenInterest
        totalPositions
        activePositions
        totalUsers
        isPaused
        lastUpdated
      }
    }
  }
`;

// Get position by ID
export const GET_POSITION_BY_ID = gql`
  ${POSITION_FRAGMENT}
  query GetPosition($positionId: String!) {
    position(id: $positionId) {
      ...PositionDetails
    }
  }
`;

// Get user deposits and withdrawals
export const GET_USER_TRANSACTIONS = gql`
  query GetUserTransactions($userAddress: String!) {
    deposits(where: { user: $userAddress }, orderBy: "timestamp", orderDirection: "desc") {
      items {
        id
        user
        amount
        newBalance
        timestamp
        blockNumber
        txHash
      }
    }
    
    withdrawals(where: { user: $userAddress }, orderBy: "timestamp", orderDirection: "desc") {
      items {
        id
        user
        amount
        newBalance
        timestamp
        blockNumber
        txHash
      }
    }
  }
`;

// Get price history for charts
export const GET_PRICE_HISTORY = gql`
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
        txHash
        updater
      }
    }
  }
`;

// Get active positions count
export const GET_ACTIVE_POSITIONS_COUNT = gql`
  query GetActivePositionsCount {
    positions(where: { status: "open" }) {
      items {
        id
        notional
        isLong
      }
    }
  }
`;

// Get latest market share data for current state
export const GET_LATEST_MARKET_SHARES = gql`
  query GetLatestMarketShares($limit: Int) {
    marketShares(
      limit: $limit
      orderBy: "timestamp"
      orderDirection: "desc"
    ) {
      items {
        id
        tokenSymbol
        timestamp
        aggregateShare
        positionCount
        totalLongExposure
      }
    }
  }
`; 