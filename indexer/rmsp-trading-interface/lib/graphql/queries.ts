import { gql } from '@apollo/client';

// Fragment for common position fields
export const POSITION_FRAGMENT = gql`
  fragment PositionDetails on Position {
    id
    user
    baseToken
    quoteToken
    notional
    isLong
    entryShare
    exitShare
    requiredMargin
    pnl
    status
    openedAt
    closedAt
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
      where: { user: $userAddress }
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
    positions(limit: $limit) {
      items {
        ...PositionDetails
      }
    }
  }
`;

// Get latest price updates
export const GET_LATEST_PRICES = gql`
  query GetLatestPrices($limit: Int!) {
    priceUpdates(limit: $limit) {
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
    protocolStatss {
      items {
        id
        totalVolume
        totalUsers
        totalPositions
        totalPnl
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
    deposits(where: { user: $userAddress }) {
      items {
        id
        user
        amount
        timestamp
        txHash
      }
    }
    
    withdrawals(where: { user: $userAddress }) {
      items {
        id
        user
        amount
        timestamp
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
      }
    }
  }
`;

// Get PositionUpdates for chart data
export const GET_POSITION_UPDATES_FOR_CHART = gql`
  query GetPositionUpdatesForChart($limit: Int, $offset: Int, $positionId: String) {
    positionUpdates(
      limit: $limit
      offset: $offset
      orderBy: "timestamp"
      orderDirection: "asc"
      where: { positionId: $positionId }
    ) {
      items {
        id
        timestamp
        currentShare # BigInt
        positionId
      }
    }
  }
`; 