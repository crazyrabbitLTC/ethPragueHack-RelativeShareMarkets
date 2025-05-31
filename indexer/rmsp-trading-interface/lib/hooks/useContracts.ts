import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, SimplePerpV2ABI, MockUSDCABI } from '@/lib/contracts/abis';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

// Position data structure
export interface OnChainPosition {
  notional: bigint;
  collateral: bigint;
  isLong: boolean;
  entryPrice: bigint;
  entryRatio: bigint;
  openTimestamp: bigint;
  hasPosition: boolean;
}

// Hook for reading user's position
export function useUserPosition() {
  const { address } = useAccount();
  
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACTS.perp,
    abi: SimplePerpV2ABI,
    functionName: 'positions',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000, // Refetch every 5 seconds
    }
  });

  const position: OnChainPosition = data ? {
    notional: data[0],
    collateral: data[1],
    isLong: data[2],
    entryPrice: data[3],
    entryRatio: data[4],
    openTimestamp: data[5],
    hasPosition: data[0] > 0n,
  } : {
    notional: 0n,
    collateral: 0n,
    isLong: false,
    entryPrice: 0n,
    entryRatio: 0n,
    openTimestamp: 0n,
    hasPosition: false,
  };

  return { position, isLoading, error, refetch };
}

// Hook for reading current ratio
export function useCurrentRatio() {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACTS.perp,
    abi: SimplePerpV2ABI,
    functionName: 'getCurrentRatio',
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds
    }
  });

  return { 
    ratio: data || 0n, 
    ratioPercent: data ? Number(data) / 1e16 : 0, // Convert to percentage
    isLoading, 
    error 
  };
}

// Hook for USDC balance and airdrop
export function useUSDC() {
  const { address } = useAccount();
  const { toast } = useToast();
  
  // Read balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: MockUSDCABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    }
  });

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: MockUSDCABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.perp] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    }
  });

  // Mint (airdrop) function
  const { 
    writeContract: mint, 
    data: mintTxHash,
    isPending: isMinting,
    error: mintError
  } = useWriteContract();

  // Approve function
  const { 
    writeContract: approve, 
    data: approveTxHash,
    isPending: isApproving,
    error: approveError
  } = useWriteContract();

  // Wait for mint transaction
  const { isLoading: isMintConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  // Wait for approve transaction
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  // Handle mint success
  useEffect(() => {
    if (isMintSuccess) {
      toast({
        title: "USDC Airdrop Successful!",
        description: "10,000 USDC has been minted to your wallet",
      });
      refetchBalance();
    }
  }, [isMintSuccess, refetchBalance, toast]);

  // Handle approve success
  useEffect(() => {
    if (isApproveSuccess) {
      toast({
        title: "Approval Successful!",
        description: "USDC spending approved for SimplePerpV2",
      });
      refetchAllowance();
    }
  }, [isApproveSuccess, refetchAllowance, toast]);

  const airdrop = async () => {
    try {
      const amount = parseUnits('10000', 6); // 10,000 USDC (6 decimals)
      mint({
        address: CONTRACTS.usdc,
        abi: MockUSDCABI,
        functionName: 'mint',
        args: [amount],
      });
    } catch (error) {
      console.error('Airdrop error:', error);
      toast({
        title: "Airdrop Failed",
        description: "Failed to mint USDC. Please try again.",
        variant: "destructive",
      });
    }
  };

  const approveMax = async () => {
    try {
      const maxAmount = parseUnits('1000000', 6); // 1M USDC approval
      approve({
        address: CONTRACTS.usdc,
        abi: MockUSDCABI,
        functionName: 'approve',
        args: [CONTRACTS.perp, maxAmount],
      });
    } catch (error) {
      console.error('Approve error:', error);
      toast({
        title: "Approval Failed",
        description: "Failed to approve USDC. Please try again.",
        variant: "destructive",
      });
    }
  };

  return {
    balance: balance || 0n,
    balanceFormatted: balance ? formatUnits(balance, 6) : '0',
    allowance: allowance || 0n,
    needsApproval: !allowance || allowance === 0n,
    airdrop,
    approveMax,
    isAirdropping: isMinting || isMintConfirming,
    isApproving: isApproving || isApproveConfirming,
    refetchBalance,
    refetchAllowance,
  };
}

// Hook for trading operations
export function useTrading() {
  const { toast } = useToast();
  const { refetch: refetchPosition } = useUserPosition();
  const { refetchBalance, refetchAllowance } = useUSDC();
  
  // Open position
  const { 
    writeContract: openPosition, 
    data: openTxHash,
    isPending: isOpening,
    error: openError
  } = useWriteContract();

  // Close position
  const { 
    writeContract: closePosition, 
    data: closeTxHash,
    isPending: isClosing,
    error: closeError
  } = useWriteContract();

  // Add collateral
  const { 
    writeContract: addCollateral, 
    data: addCollatTxHash,
    isPending: isAddingCollateral,
    error: addCollatError
  } = useWriteContract();

  // Wait for transactions
  const { isLoading: isOpenConfirming, isSuccess: isOpenSuccess } = useWaitForTransactionReceipt({
    hash: openTxHash,
  });

  const { isLoading: isCloseConfirming, isSuccess: isCloseSuccess } = useWaitForTransactionReceipt({
    hash: closeTxHash,
  });

  const { isLoading: isAddCollatConfirming, isSuccess: isAddCollatSuccess } = useWaitForTransactionReceipt({
    hash: addCollatTxHash,
  });

  // Handle success notifications
  useEffect(() => {
    if (isOpenSuccess) {
      toast({
        title: "Position Opened!",
        description: "Your position has been successfully opened",
      });
      refetchPosition();
      refetchBalance();
    }
  }, [isOpenSuccess, refetchPosition, refetchBalance, toast]);

  useEffect(() => {
    if (isCloseSuccess) {
      toast({
        title: "Position Closed!",
        description: "Your position has been successfully closed",
      });
      refetchPosition();
      refetchBalance();
    }
  }, [isCloseSuccess, refetchPosition, refetchBalance, toast]);

  useEffect(() => {
    if (isAddCollatSuccess) {
      toast({
        title: "Collateral Added!",
        description: "Additional collateral has been added to your position",
      });
      refetchPosition();
      refetchBalance();
    }
  }, [isAddCollatSuccess, refetchPosition, refetchBalance, toast]);

  const open = async (notionalUSDC: string, isLong: boolean) => {
    try {
      const notional = parseUnits(notionalUSDC, 6); // Convert to 6 decimal USDC
      openPosition({
        address: CONTRACTS.perp,
        abi: SimplePerpV2ABI,
        functionName: 'openPosition',
        args: [notional, isLong],
      });
    } catch (error) {
      console.error('Open position error:', error);
      toast({
        title: "Failed to Open Position",
        description: "Please check your balance and try again.",
        variant: "destructive",
      });
    }
  };

  const close = async () => {
    try {
      closePosition({
        address: CONTRACTS.perp,
        abi: SimplePerpV2ABI,
        functionName: 'closePosition',
      });
    } catch (error) {
      console.error('Close position error:', error);
      toast({
        title: "Failed to Close Position",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const addMoreCollateral = async (amountUSDC: string) => {
    try {
      const amount = parseUnits(amountUSDC, 6); // Convert to 6 decimal USDC
      addCollateral({
        address: CONTRACTS.perp,
        abi: SimplePerpV2ABI,
        functionName: 'addCollateral',
        args: [amount],
      });
    } catch (error) {
      console.error('Add collateral error:', error);
      toast({
        title: "Failed to Add Collateral",
        description: "Please check your balance and try again.",
        variant: "destructive",
      });
    }
  };

  return {
    openPosition: open,
    closePosition: close,
    addCollateral: addMoreCollateral,
    isOpening: isOpening || isOpenConfirming,
    isClosing: isClosing || isCloseConfirming,
    isAddingCollateral: isAddingCollateral || isAddCollatConfirming,
  };
}