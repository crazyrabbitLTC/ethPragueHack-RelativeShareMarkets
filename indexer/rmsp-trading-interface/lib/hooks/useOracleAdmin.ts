import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { CONTRACTS } from '@/lib/contracts/abis';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

const RATIO_ORACLE_ABI = [
  {
    "inputs": [
      { "name": "ethPrice", "type": "uint256" },
      { "name": "btcPrice", "type": "uint256" },
      { "name": "timestamp", "type": "uint256" }
    ],
    "name": "updatePrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "lastUpdateTimestamp",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentRatio",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export function useOracleAdmin() {
  const { address } = useAccount();
  const { toast } = useToast();

  // Read last update timestamp
  const { data: lastUpdateTimestamp } = useReadContract({
    address: CONTRACTS.oracle,
    abi: RATIO_ORACLE_ABI,
    functionName: 'lastUpdateTimestamp',
    query: {
      refetchInterval: 10000,
    }
  });

  // Read current ratio
  const { data: currentRatio } = useReadContract({
    address: CONTRACTS.oracle,
    abi: RATIO_ORACLE_ABI,
    functionName: 'currentRatio',
    query: {
      refetchInterval: 10000,
    }
  });

  // Read owner
  const { data: owner } = useReadContract({
    address: CONTRACTS.oracle,
    abi: RATIO_ORACLE_ABI,
    functionName: 'owner',
  });

  // Update price function
  const { 
    writeContract: updatePrice, 
    data: updateTxHash,
    isPending: isUpdating,
    error: updateError
  } = useWriteContract();

  // Wait for transaction
  const { isLoading: isUpdateConfirming, isSuccess: isUpdateSuccess } = useWaitForTransactionReceipt({
    hash: updateTxHash,
  });

  // Handle success
  useEffect(() => {
    if (isUpdateSuccess) {
      toast({
        title: "Oracle Updated! 🎯",
        description: "Prices have been updated successfully",
      });
    }
  }, [isUpdateSuccess, toast]);

  // Handle errors
  useEffect(() => {
    if (updateError) {
      toast({
        title: "Update Failed",
        description: updateError.message.includes("Ownable") 
          ? "Only the contract owner can update prices" 
          : "Failed to update oracle prices",
        variant: "destructive",
      });
    }
  }, [updateError, toast]);

  const updateOraclePrice = async (ethPriceUSD: string, btcPriceUSD: string) => {
    try {
      const ethPrice = parseUnits(ethPriceUSD, 18);
      const btcPrice = parseUnits(btcPriceUSD, 18);
      const timestamp = BigInt(Math.floor(Date.now() / 1000));

      updatePrice({
        address: CONTRACTS.oracle,
        abi: RATIO_ORACLE_ABI,
        functionName: 'updatePrice',
        args: [ethPrice, btcPrice, timestamp],
      });
    } catch (error) {
      console.error('Oracle update error:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update oracle prices",
        variant: "destructive",
      });
    }
  };

  const updateWithCurrentMarketPrices = async () => {
    // Use realistic current market prices
    const ethPrice = "2542.47";
    const btcPrice = "104710.62";
    await updateOraclePrice(ethPrice, btcPrice);
  };

  const isOwner = owner && address && owner.toLowerCase() === address.toLowerCase();
  const lastUpdate = lastUpdateTimestamp ? new Date(Number(lastUpdateTimestamp) * 1000) : null;
  const currentRatioPercent = currentRatio ? Number(currentRatio) / 1e16 : 0;
  const isStale = lastUpdate ? (Date.now() - lastUpdate.getTime()) > 300000 : true; // 5 minutes

  return {
    updateOraclePrice,
    updateWithCurrentMarketPrices,
    isUpdating: isUpdating || isUpdateConfirming,
    isOwner,
    lastUpdate,
    currentRatioPercent,
    isStale,
  };
}