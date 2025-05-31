// GraphQL types from the indexer

export interface Position {
  id: string;
  trader: string;
  baseToken: string;
  quoteToken: string;
  notional: string; // BigInt as string
  margin: string; // BigInt as string
  isLong: boolean;
  leverage: string; // BigInt as string
  entryRatio: string; // BigInt as string
  entryShares: string; // BigInt as string
  exitShares?: string | null; // BigInt as string
  pnl?: string | null; // BigInt as string
  status: 'open' | 'closed';
  openedAt: number;
  closedAt?: number | null;
  lastUpdated: number;
  openTxHash: string;
  closeTxHash?: string | null;
  openBlockNumber: string; // BigInt as string
  closeBlockNumber?: string | null; // BigInt as string
}

export interface PositionUpdate {
  id: string;
  trader: string;
  positionId: string;
  timestamp: number;
  blockNumber: string; // BigInt as string
  currentRatio: string; // BigInt as string
  currentShares: string; // BigInt as string
  unrealizedPnl: string; // BigInt as string
  txHash: string;
}

export interface MarketShare {
  id: string;
  tokenSymbol: string;
  timestamp: number;
  blockNumber: string; // BigInt as string
  aggregateShare: string; // BigInt as string (scaled by 1e18)
  positionCount: string; // BigInt as string
  totalLongExposure: string; // BigInt as string
  totalShortExposure: string; // BigInt as string
}

export interface PriceUpdate {
  id: string;
  timestamp: number;
  blockNumber: string; // BigInt as string
  txHash: string;
  updater: string;
}

export interface Deposit {
  id: string;
  user: string;
  amount: string; // BigInt as string
  newBalance: string; // BigInt as string
  timestamp: number;
  blockNumber: string; // BigInt as string
  txHash: string;
}

export interface Withdrawal {
  id: string;
  user: string;
  amount: string; // BigInt as string
  newBalance: string; // BigInt as string
  timestamp: number;
  blockNumber: string; // BigInt as string
  txHash: string;
}

export interface ProtocolStats {
  id: string;
  totalDeposits: string; // BigInt as string
  totalOpenInterest: string; // BigInt as string
  totalPositions: number;
  activePositions: number;
  totalUsers: number;
  isPaused: boolean;
  lastUpdated: number;
}

// Query response types
export interface PositionsResponse {
  positions: {
    items: Position[];
  };
}

export interface PositionUpdatesResponse {
  positionUpdates: {
    items: PositionUpdate[];
  };
}

export interface MarketSharesResponse {
  marketShares: {
    items: MarketShare[];
  };
}

export interface PriceUpdatesResponse {
  priceUpdates: {
    items: PriceUpdate[];
  };
}

export interface ProtocolStatsResponse {
  protocolStats: {
    items: ProtocolStats[];
  };
}

export interface UserTransactionsResponse {
  deposits: {
    items: Deposit[];
  };
  withdrawals: {
    items: Withdrawal[];
  };
} 