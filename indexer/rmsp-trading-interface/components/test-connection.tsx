'use client';

import { useAllPositions } from '@/lib/hooks/usePositions';
import { formatAddress, formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { useEffect } from 'react';

export function TestConnection() {
  const { positions, loading, error } = useAllPositions(5);
  
  // Log for debugging
  useEffect(() => {
    console.log('GraphQL Status:', { loading, error, positionsCount: positions?.length });
  }, [loading, error, positions]);

  if (loading) return <div className="p-4 text-white">Loading positions from indexer...</div>;
  
  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
        <h3 className="text-red-400 font-semibold mb-2">GraphQL Connection Error</h3>
        <p className="text-red-300 text-sm">{error.message}</p>
        <p className="text-gray-400 text-xs mt-2">Make sure the indexer is running at http://localhost:42070/</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h3 className="text-white font-semibold mb-4">GraphQL Connection Test</h3>
      
      {positions.length === 0 ? (
        <div>
          <p className="text-yellow-400 mb-2">⚠️ Connected to indexer but no positions found</p>
          <p className="text-gray-400 text-sm">The indexer is running but there may be no data indexed yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-green-400 mb-2">✅ Connected to indexer! Found {positions.length} positions:</p>
          {positions.map((position) => (
            <div key={position.id} className="bg-gray-900 p-3 rounded text-sm">
              <div className="text-white">
                Position #{position.id.slice(-8)} • {position.isLong ? 'LONG' : 'SHORT'} • {position.status.toUpperCase()}
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