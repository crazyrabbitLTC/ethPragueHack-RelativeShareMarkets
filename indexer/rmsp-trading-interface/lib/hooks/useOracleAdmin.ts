import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { CONTRACTS } from '@/lib/contracts/abis';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

const RATIO_ORACLE_ABI = [
  {
    "inputs": [
      { "name": "token", "type": "string" },
      { "name": "price", "type": "uint256" }
    ],
    "name": "setPrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "", "type": "string" }],
    "name": "mockPrices",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "baseToken", "type": "string" },
      { "name": "quoteToken", "type": "string" }
    ],
    "name": "getRatioShare",
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
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "name": "timestamp", "type": "uint256" }
    ],
    "name": "PricesUpdated",
    "type": "event"
  }
] as const;

export function useOracleAdmin() {
  const { address } = useAccount();
  const { toast } = useToast();

  // Note: The contract doesn't track last update timestamps for mock prices

  // Read ETH price
  const { data: ethPrice } = useReadContract({
    address: CONTRACTS.oracle,
    abi: RATIO_ORACLE_ABI,
    functionName: 'mockPrices',
    args: ['ETH'],
    query: {
      refetchInterval: 5000,
    }
  });

  // Read BTC price
  const { data: btcPrice } = useReadContract({
    address: CONTRACTS.oracle,
    abi: RATIO_ORACLE_ABI,
    functionName: 'mockPrices',
    args: ['BTC'],
    query: {
      refetchInterval: 5000,
    }
  });

  // Get current ratio
  const { data: currentRatio } = useReadContract({
    address: CONTRACTS.oracle,
    abi: RATIO_ORACLE_ABI,
    functionName: 'getRatioShare',
    args: ['ETH', 'BTC'],
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

  // Update ETH price function
  const { 
    writeContract: updateEthPrice, 
    data: ethTxHash,
    isPending: isUpdatingEth,
    error: ethError
  } = useWriteContract();

  // Update BTC price function
  const { 
    writeContract: updateBtcPrice, 
    data: btcTxHash,
    isPending: isUpdatingBtc,
    error: btcError
  } = useWriteContract();

  // Wait for transactions
  const { isLoading: isEthConfirming, isSuccess: isEthSuccess } = useWaitForTransactionReceipt({
    hash: ethTxHash,
  });

  const { isLoading: isBtcConfirming, isSuccess: isBtcSuccess } = useWaitForTransactionReceipt({
    hash: btcTxHash,
  });

  // Handle success
  useEffect(() => {
    if (isEthSuccess && isBtcSuccess) {
      toast({
        title: "Oracle Updated! 🎯",
        description: "Both ETH and BTC prices have been updated",
      });
    }
  }, [isEthSuccess, isBtcSuccess, toast]);

  // Handle errors
  useEffect(() => {
    const error = ethError || btcError;
    if (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update oracle prices",
        variant: "destructive",
      });
    }
  }, [ethError, btcError, toast]);

  const updateOraclePrice = async (ethPriceUSD: string, btcPriceUSD: string) => {
    try {
      const ethPrice = parseUnits(ethPriceUSD, 18);
      const btcPrice = parseUnits(btcPriceUSD, 18);

      // Update ETH price
      updateEthPrice({
        address: CONTRACTS.oracle,
        abi: RATIO_ORACLE_ABI,
        functionName: 'setPrice',
        args: ['ETH', ethPrice],
      });

      // Wait a bit, then update BTC price
      setTimeout(() => {
        updateBtcPrice({
          address: CONTRACTS.oracle,
          abi: RATIO_ORACLE_ABI,
          functionName: 'setPrice',
          args: ['BTC', btcPrice],
        });
      }, 1000);
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
  const currentRatioPercent = currentRatio ? Number(currentRatio) / 1e16 : 0;
  const isUpdating = isUpdatingEth || isUpdatingBtc || isEthConfirming || isBtcConfirming;

  return {
    updateOraclePrice,
    updateWithCurrentMarketPrices,
    isUpdating,
    isOwner,
    currentRatioPercent,
    ethPrice,
    btcPrice,
  };
}