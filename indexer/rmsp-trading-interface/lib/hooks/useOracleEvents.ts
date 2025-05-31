import { useState, useEffect } from 'react';
import { useWatchContractEvent, usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';

interface OracleUpdate {
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: string;
}

export function useOracleEvents(oracleAddress?: `0x${string}`) {
  const [updateHistory, setUpdateHistory] = useState<OracleUpdate[]>([]);
  const publicClient = usePublicClient();

  // Listen for PricesUpdated events
  useWatchContractEvent({
    address: oracleAddress,
    abi: [parseAbiItem('event PricesUpdated(uint256 timestamp)')],
    eventName: 'PricesUpdated',
    onLogs(logs) {
      logs.forEach((log) => {
        if ('args' in log && log.args && 'timestamp' in log.args) {
          const newUpdate: OracleUpdate = {
            timestamp: log.args.timestamp as bigint,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          };

          setUpdateHistory((prev) => {
            // Add new update and keep only the last 5
            const updated = [newUpdate, ...prev].slice(0, 5);
            return updated;
          });
        }
      });
    },
  });

  // Fetch recent events on mount
  useEffect(() => {
    if (!oracleAddress || !publicClient) return;

    const fetchRecentEvents = async () => {
      try {
        const logs = await publicClient.getLogs({
          address: oracleAddress,
          event: parseAbiItem('event PricesUpdated(uint256 timestamp)'),
          fromBlock: 'latest',
          toBlock: 'latest',
        });

        const updates = logs.map(log => ({
          timestamp: log.args?.timestamp as bigint,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        })).filter(u => u.timestamp);

        setUpdateHistory(updates.slice(0, 5));
      } catch (error) {
        console.error('Error fetching oracle events:', error);
      }
    };

    fetchRecentEvents();
  }, [oracleAddress, publicClient]);

  return {
    updateHistory,
    latestUpdate: updateHistory[0] || null,
    hasUpdates: updateHistory.length > 0,
  };
}