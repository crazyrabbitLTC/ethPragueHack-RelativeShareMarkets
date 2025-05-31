// GraphQL types from the indexer

export interface Position {
  id: string;
  user: string;
  baseToken: string;
  quoteToken: string;
  notional: string; // BigInt as string
  isLong: boolean;
  entryShare: string; // BigInt as string
  exitShare?: string | null; // BigInt as string
  requiredMargin: string; // BigInt as string
  pnl?: string | null; // BigInt as string
  status: 'open' | 'closed';
  openedAt: number;
  closedAt?: number | null;
  openTxHash: string;
  closeTxHash?: string | null;
  openBlockNumber: string; // BigInt as string
  closeBlockNumber?: string | null; // BigInt as string
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
  timestamp: number;
  txHash: string;
}

export interface Withdrawal {
  id: string;
  user: string;
  amount: string; // BigInt as string
  timestamp: number;
  txHash: string;
}

export interface ProtocolStats {
  id: string;
  totalVolume?: string; // BigInt as string
  totalUsers?: number;
  totalPositions?: number;
  totalPnl?: string; // BigInt as string
  lastUpdated?: number;
}

// Query response types
export interface PositionsResponse {
  positions: {
    items: Position[];
  };
}

export interface PriceUpdatesResponse {
  priceUpdates: {
    items: PriceUpdate[];
  };
}

export interface ProtocolStatsResponse {
  protocolStatss: {
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