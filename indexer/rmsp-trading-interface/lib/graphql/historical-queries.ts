import { gql } from '@apollo/client';

// Get historical price data for charts
export const GET_HISTORICAL_PRICES = gql`
  query GetHistoricalPrices($from: Int!, $to: Int!, $limit: Int = 1000) {
    historicalPrices(
      where: {
        timestamp_gte: $from,
        timestamp_lte: $to
      },
      orderBy: "timestamp",
      orderDirection: "asc",
      limit: $limit
    ) {
      items {
        id
        timestamp
        blockNumber
        ethPrice
        btcPrice
        ethShare
        btcShare
        priceUpdater
        txHash
      }
    }
  }
`;

// Get recent price updates for live data
export const GET_RECENT_PRICE_UPDATES = gql`
  query GetRecentPriceUpdates($limit: Int = 100) {
    historicalPrices(
      orderBy: "timestamp",
      orderDirection: "desc",
      limit: $limit
    ) {
      items {
        id
        timestamp
        ethPrice
        btcPrice
        ethShare
        btcShare
        priceUpdater
      }
    }
  }
`;

// Get market share history for analytics
export const GET_MARKET_SHARE_HISTORY = gql`
  query GetMarketShareHistory($from: Int!, $to: Int!) {
    marketShareHistories(
      where: {
        timestamp_gte: $from,
        timestamp_lte: $to
      },
      orderBy: "timestamp",
      orderDirection: "asc"
    ) {
      items {
        id
        timestamp
        ethShare
        btcShare
        totalPositionCount
        totalNotional
        ethPrice
        btcPrice
        triggerType
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
        ethPrice
        btcPrice
        ethShare
        btcShare
        priceUpdater
      }
    }
    
    marketShareHistories(
      orderBy: "timestamp", 
      orderDirection: "desc",
      limit: 1
    ) {
      items {
        timestamp
        totalPositionCount
        totalNotional
        triggerType
      }
    }
  }
`;

// Get price updates by specific updater (e.g., your demo wallet)
export const GET_PRICE_UPDATES_BY_UPDATER = gql`
  query GetPriceUpdatesByUpdater($updater: String!, $limit: Int = 50) {
    historicalPrices(
      where: {
        priceUpdater: $updater
      },
      orderBy: "timestamp",
      orderDirection: "desc",
      limit: $limit
    ) {
      items {
        timestamp
        ethPrice
        btcPrice
        ethShare
        btcShare
        txHash
      }
    }
  }
`;

// Get aggregated price data for different time intervals
export const GET_AGGREGATED_PRICE_DATA = gql`
  query GetAggregatedPriceData($from: Int!, $interval: Int!) {
    historicalPrices(
      where: {
        timestamp_gte: $from
      },
      orderBy: "timestamp",
      orderDirection: "asc"
    ) {
      items {
        timestamp
        ethShare
        btcShare
        ethPrice
        btcPrice
      }
    }
  }
`;

// Get Pyth-specific price updates (if indexing Pyth contract directly)
export const GET_PYTH_PRICE_UPDATES = gql`
  query GetPythPriceUpdates($from: Int!, $to: Int!) {
    pythPriceUpdates(
      where: {
        blockTimestamp_gte: $from,
        blockTimestamp_lte: $to
      },
      orderBy: "blockTimestamp",
      orderDirection: "asc"
    ) {
      items {
        id
        token
        priceId
        price
        confidence
        publishTime
        blockTimestamp
        updater
      }
    }
  }
`;

// Get price update frequency analysis
export const GET_PRICE_UPDATE_STATS = gql`
  query GetPriceUpdateStats($from: Int!) {
    historicalPrices(
      where: {
        timestamp_gte: $from
      },
      orderBy: "timestamp",
      orderDirection: "desc"
    ) {
      items {
        timestamp
        priceUpdater
      }
    }
    
    priceUpdates(
      where: {
        timestamp_gte: $from
      }
    ) {
      items {
        timestamp
        updater
      }
    }
  }
`;

// Subscribe to real-time price updates (if using subscriptions)
export const SUBSCRIBE_TO_PRICE_UPDATES = gql`
  subscription OnPriceUpdate {
    historicalPrices(
      orderBy: "timestamp",
      orderDirection: "desc",
      limit: 1
    ) {
      items {
        timestamp
        ethPrice
        btcPrice
        ethShare
        btcShare
        priceUpdater
      }
    }
  }
`;

// Get chart data optimized for different timeframes
export const GET_CHART_DATA_HOURLY = gql`
  query GetChartDataHourly($from: Int!, $to: Int!) {
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
        ethShare
        btcShare
      }
    }
  }
`;

export const GET_CHART_DATA_DAILY = gql`
  query GetChartDataDaily($from: Int!, $to: Int!) {
    marketShareHistories(
      where: {
        timestamp_gte: $from,
        timestamp_lte: $to,
        triggerType: "price_update"
      },
      orderBy: "timestamp",
      orderDirection: "asc"
    ) {
      items {
        timestamp
        ethShare
        btcShare
        totalPositionCount
      }
    }
  }
`;

// Helper query for data validation
export const VALIDATE_HISTORICAL_DATA = gql`
  query ValidateHistoricalData {
    historicalPrices(limit: 5, orderBy: "timestamp", orderDirection: "desc") {
      items {
        timestamp
        ethShare
        btcShare
        priceUpdater
      }
    }
    
    marketShareHistories(limit: 5, orderBy: "timestamp", orderDirection: "desc") {
      items {
        timestamp
        triggerType
        totalPositionCount
      }
    }
  }
`;

// Export all queries for easy importing
export const HISTORICAL_QUERIES = {
  GET_HISTORICAL_PRICES,
  GET_RECENT_PRICE_UPDATES,
  GET_MARKET_SHARE_HISTORY,
  GET_LATEST_MARKET_STATE,
  GET_PRICE_UPDATES_BY_UPDATER,
  GET_AGGREGATED_PRICE_DATA,
  GET_PYTH_PRICE_UPDATES,
  GET_PRICE_UPDATE_STATS,
  SUBSCRIBE_TO_PRICE_UPDATES,
  GET_CHART_DATA_HOURLY,
  GET_CHART_DATA_DAILY,
  VALIDATE_HISTORICAL_DATA,
};