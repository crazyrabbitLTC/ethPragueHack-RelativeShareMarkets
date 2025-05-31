'use client';

import { useAllPositions } from '@/lib/hooks/usePositions';
import { formatAddress, formatCurrency, formatPercent } from '@/lib/utils/formatters';

export function TestConnection() {
  const { positions, loading, error } = useAllPositions(5);

  if (loading) return <div className="p-4 text-white">Loading positions...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error.message}</div>;

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h3 className="text-white font-semibold mb-4">GraphQL Connection Test</h3>
      
      {positions.length === 0 ? (
        <p className="text-gray-400">No positions found in the indexer</p>
      ) : (
        <div className="space-y-2">
          <p className="text-green-400 mb-2">✅ Connected to indexer! Found {positions.length} positions:</p>
          {positions.map((position) => (
            <div key={position.id} className="bg-gray-900 p-3 rounded text-sm">
              <div className="text-white">
                Position #{position.id} • {position.isLong ? 'LONG' : 'SHORT'} • {position.status.toUpperCase()}
              </div>
              <div className="text-gray-400 text-xs mt-1">
                User: {formatAddress(position.user)} • 
                Notional: {formatCurrency(position.notional)} • 
                PnL: {position.pnl ? formatCurrency(position.pnl) : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 