import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { CONTRACTS, SimplePerpV2ABI, MockUSDCABI, RatioOracleABI } from '@/lib/contracts/abis';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

// Position data structure
export interface OnChainPosition {
  baseToken: string;
  quoteToken: string;
  notional: bigint;
  isLong: boolean;
  entryShare: bigint;
  openedAt: bigint;
  lastUpdated: bigint;
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
  
  // Also read the user's deposited balance in the perp contract
  const { data: perpBalance, refetch: refetchPerpBalance } = useReadContract({
    address: CONTRACTS.perp,
    abi: SimplePerpV2ABI,
    functionName: 'balances',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    }
  });

  const position: OnChainPosition = data ? {
    baseToken: data[0] || '',
    quoteToken: data[1] || '',
    notional: data[2] || 0n,
    isLong: data[3] || false,
    entryShare: data[4] || 0n,
    openedAt: data[5] || 0n,
    lastUpdated: data[6] || 0n,
    hasPosition: (data[2] || 0n) > 0n, // Check notional > 0
  } : {
    baseToken: '',
    quoteToken: '',
    notional: 0n,
    isLong: false,
    entryShare: 0n,
    openedAt: 0n,
    lastUpdated: 0n,
    hasPosition: false,
  };
  

  return { 
    position, 
    isLoading, 
    error, 
    refetch,
    perpBalance: perpBalance || 0n,
    perpBalanceFormatted: perpBalance ? formatUnits(perpBalance, 6) : '0',
    refetchPerpBalance 
  };
}

// Hook for reading current ratio
export function useCurrentRatio(baseToken: string = "ETH", quoteToken: string = "BTC") {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACTS.oracle,
    abi: RatioOracleABI,
    functionName: 'getRatioShare',
    args: [baseToken, quoteToken],
    query: {
      refetchInterval: 10000, // Refetch every 10 seconds
    }
  });

  return { 
    ratio: data || 0n, 
    ratioPercent: data ? Number(data) / 1e16 : 0, // Convert to percentage (1e18 to percentage)
    isLoading, 
    error 
  };
}

// Hook to check if using mock prices
export function useOraclePriceMode() {
  const { data: useMockPrices } = useReadContract({
    address: CONTRACTS.oracle,
    abi: RatioOracleABI,
    functionName: 'useMockPrices',
  });
  
  return { useMockPrices: useMockPrices ?? true };
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

  // Handle mint transactions
  useEffect(() => {
    if (mintTxHash) {
      toast({
        title: "Minting USDC...",
        description: `Transaction submitted - View on Arbiscan: https://arbiscan.io/tx/${mintTxHash}`,
      });
    }
  }, [mintTxHash, toast]);
  
  useEffect(() => {
    if (isMintSuccess) {
      toast({
        title: "USDC Airdrop Successful! 💰",
        description: `$1,000,000 USDC has been minted - View tx: https://arbiscan.io/tx/${mintTxHash}`,
      });
      refetchBalance();
    }
  }, [isMintSuccess, mintTxHash, refetchBalance, toast]);

  // Handle approve transactions
  useEffect(() => {
    if (approveTxHash) {
      toast({
        title: "Approving USDC...",
        description: `Transaction submitted - View on Arbiscan: https://arbiscan.io/tx/${approveTxHash}`,
      });
    }
  }, [approveTxHash, toast]);
  
  useEffect(() => {
    if (isApproveSuccess) {
      toast({
        title: "Approval Successful! ✅",
        description: `USDC spending approved - View tx: https://arbiscan.io/tx/${approveTxHash}`,
      });
      refetchAllowance();
    }
  }, [isApproveSuccess, approveTxHash, refetchAllowance, toast]);
  
  // Handle errors
  useEffect(() => {
    if (mintError) {
      toast({
        title: "Airdrop Failed ❌",
        description: mintError.message || "Failed to mint USDC. Please try again.",
        variant: "destructive",
      });
    }
  }, [mintError, toast]);
  
  useEffect(() => {
    if (approveError) {
      toast({
        title: "Approval Failed ❌",
        description: approveError.message || "Failed to approve USDC. Please try again.",
        variant: "destructive",
      });
    }
  }, [approveError, toast]);

  const airdrop = async () => {
    if (!address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const amount = parseUnits('1000000', 6); // 1,000,000 USDC (6 decimals)
      mint({
        address: CONTRACTS.usdc,
        abi: MockUSDCABI,
        functionName: 'mint',
        args: [address, amount], // Pass the user's address and amount
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
  const { refetch: refetchPosition, refetchPerpBalance } = useUserPosition();
  const { refetchBalance, refetchAllowance } = useUSDC();
  const { useMockPrices } = useOraclePriceMode();
  const [shouldUpdateOracle, setShouldUpdateOracle] = useState(true); // Toggle for auto-update
  const [pendingPosition, setPendingPosition] = useState<{
    notionalUSDC: string;
    isLong: boolean;
    baseToken: string;
    quoteToken: string;
  } | null>(null);
  
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
  
  // Deposit USDC
  const { 
    writeContract: depositUSDC, 
    data: depositTxHash,
    isPending: isDepositing,
    error: depositError
  } = useWriteContract();
  
  // Withdraw USDC
  const { 
    writeContract: withdrawUSDC, 
    data: withdrawTxHash,
    isPending: isWithdrawing,
    error: withdrawError
  } = useWriteContract();
  
  // Update prices
  const { 
    writeContract: updatePrices, 
    data: updatePriceTxHash,
    isPending: isUpdatingPrices,
    error: updatePriceError
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
  
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositTxHash,
  });
  
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({
    hash: withdrawTxHash,
  });
  
  const { isLoading: isUpdatePriceConfirming, isSuccess: isUpdatePriceSuccess } = useWaitForTransactionReceipt({
    hash: updatePriceTxHash,
  });

  // Handle transaction status updates
  useEffect(() => {
    if (openTxHash) {
      toast({
        title: "Opening Position...",
        description: `Transaction submitted - View on Arbiscan: https://arbiscan.io/tx/${openTxHash}`,
      });
    }
  }, [openTxHash, toast]);

  useEffect(() => {
    if (isOpenSuccess) {
      toast({
        title: "Position Opened! ✅",
        description: `Your position has been successfully opened - View tx: https://arbiscan.io/tx/${openTxHash}`,
      });
      refetchPosition();
      refetchBalance();
    }
  }, [isOpenSuccess, openTxHash, refetchPosition, refetchBalance, toast]);

  useEffect(() => {
    if (closeTxHash) {
      toast({
        title: "Closing Position...",
        description: `Transaction submitted - View on Arbiscan: https://arbiscan.io/tx/${closeTxHash}`,
      });
    }
  }, [closeTxHash, toast]);

  useEffect(() => {
    if (isCloseSuccess) {
      toast({
        title: "Position Closed! ✅",
        description: `Your position has been successfully closed - View tx: https://arbiscan.io/tx/${closeTxHash}`,
      });
      refetchPosition();
      refetchBalance();
    }
  }, [isCloseSuccess, closeTxHash, refetchPosition, refetchBalance, toast]);

  useEffect(() => {
    if (isAddCollatSuccess) {
      toast({
        title: "Collateral Added! ✅",
        description: "Additional collateral has been added to your position",
      });
      refetchPosition();
      refetchBalance();
    }
  }, [isAddCollatSuccess, refetchPosition, refetchBalance, toast]);
  
  // Handle deposit success
  useEffect(() => {
    if (depositTxHash) {
      toast({
        title: "Depositing USDC...",
        description: `Transaction submitted - View on Arbiscan: https://arbiscan.io/tx/${depositTxHash}`,
      });
    }
  }, [depositTxHash, toast]);
  
  useEffect(() => {
    if (isDepositSuccess) {
      toast({
        title: "Deposit Successful! ✅",
        description: `USDC deposited to trading account - View tx: https://arbiscan.io/tx/${depositTxHash}`,
      });
      refetchPosition();
      refetchPerpBalance();
      refetchBalance();
    }
  }, [isDepositSuccess, depositTxHash, refetchPosition, refetchPerpBalance, refetchBalance, toast]);
  
  // Handle withdraw transactions
  useEffect(() => {
    if (withdrawTxHash) {
      toast({
        title: "Withdrawing USDC...",
        description: `Transaction submitted - View on Arbiscan: https://arbiscan.io/tx/${withdrawTxHash}`,
      });
    }
  }, [withdrawTxHash, toast]);
  
  useEffect(() => {
    if (isWithdrawSuccess) {
      toast({
        title: "Withdrawal Successful! ✅",
        description: `USDC withdrawn to wallet - View tx: https://arbiscan.io/tx/${withdrawTxHash}`,
      });
      refetchPosition();
      refetchBalance();
    }
  }, [isWithdrawSuccess, withdrawTxHash, refetchPosition, refetchBalance, toast]);

  // Handle errors
  useEffect(() => {
    if (openError) {
      // Check if it's a price stale error
      const errorMessage = openError.message || "";
      if (errorMessage.includes("Price too stale")) {
        toast({
          title: "Price Data Too Old ⏰",
          description: "Click the 'Update Oracle Prices' button to refresh prices before trading.",
          variant: "destructive",
        });
      } else if (errorMessage.includes("Insufficient margin")) {
        toast({
          title: "Insufficient Margin ❌",
          description: "You need to deposit more USDC to your trading account.",
          variant: "destructive",
        });
      } else if (errorMessage.includes("execution reverted")) {
        toast({
          title: "Transaction Reverted ❌",
          description: "The transaction failed. Please check your balances and try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Transaction Failed ❌",
          description: openError.message || "Failed to open position. Please try again.",
          variant: "destructive",
        });
      }
    }
  }, [openError, toast]);

  useEffect(() => {
    if (closeError) {
      toast({
        title: "Transaction Failed ❌",
        description: closeError.message || "Failed to close position. Please try again.",
        variant: "destructive",
      });
    }
  }, [closeError, toast]);
  
  useEffect(() => {
    if (depositError) {
      toast({
        title: "Deposit Failed ❌",
        description: depositError.message || "Failed to deposit. Please check your approval and balance.",
        variant: "destructive",
      });
    }
  }, [depositError, toast]);
  
  useEffect(() => {
    if (withdrawError) {
      toast({
        title: "Withdrawal Failed ❌",
        description: withdrawError.message || "Failed to withdraw. Please check your balance.",
        variant: "destructive",
      });
    }
  }, [withdrawError, toast]);
  
  // Handle price update success - open position after prices are updated
  useEffect(() => {
    if (updatePriceTxHash) {
      toast({
        title: "Updating Prices...",
        description: `Price update submitted - View on Arbiscan: https://arbiscan.io/tx/${updatePriceTxHash}`,
      });
    }
  }, [updatePriceTxHash, toast]);
  
  useEffect(() => {
    if (isUpdatePriceSuccess && pendingPosition) {
      toast({
        title: "Prices Updated! ✅",
        description: "Now opening your position with fresh prices",
      });
      
      // Open the position with updated prices
      const notional = parseUnits(pendingPosition.notionalUSDC, 6);
      openPosition({
        address: CONTRACTS.perp,
        abi: SimplePerpV2ABI,
        functionName: 'openPosition',
        args: [pendingPosition.baseToken, pendingPosition.quoteToken, notional, pendingPosition.isLong],
      });
      
      // Clear pending position
      setPendingPosition(null);
    }
  }, [isUpdatePriceSuccess, pendingPosition, openPosition, toast]);

  const open = async (notionalUSDC: string, isLong: boolean, baseToken: string = "ETH", quoteToken: string = "BTC") => {
    try {
      console.log('Opening position with:', { baseToken, quoteToken, notionalUSDC, isLong });
      
      const notional = parseUnits(notionalUSDC, 6); // Convert to 6 decimal USDC
      openPosition({
        address: CONTRACTS.perp,
        abi: SimplePerpV2ABI,
        functionName: 'openPosition',
        args: [baseToken, quoteToken, notional, isLong],
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
  
  const deposit = async (amountUSDC: string) => {
    try {
      const amount = parseUnits(amountUSDC, 6); // Convert to 6 decimal USDC
      depositUSDC({
        address: CONTRACTS.perp,
        abi: SimplePerpV2ABI,
        functionName: 'deposit',
        args: [amount],
      });
    } catch (error) {
      console.error('Deposit error:', error);
      toast({
        title: "Failed to Deposit",
        description: "Please check your balance and approval.",
        variant: "destructive",
      });
    }
  };
  
  const withdraw = async (amountUSDC: string) => {
    try {
      const amount = parseUnits(amountUSDC, 6); // Convert to 6 decimal USDC
      withdrawUSDC({
        address: CONTRACTS.perp,
        abi: SimplePerpV2ABI,
        functionName: 'withdraw',
        args: [amount],
      });
    } catch (error) {
      console.error('Withdraw error:', error);
      toast({
        title: "Failed to Withdraw",
        description: "Please check your balance and open positions.",
        variant: "destructive",
      });
    }
  };

  return {
    openPosition: open,
    closePosition: close,
    addCollateral: addMoreCollateral,
    deposit,
    withdraw,
    isOpening: isOpening || isOpenConfirming || isUpdatingPrices || isUpdatePriceConfirming,
    isClosing: isClosing || isCloseConfirming,
    isAddingCollateral: isAddingCollateral || isAddCollatConfirming,
    isDepositing: isDepositing || isDepositConfirming,
    isWithdrawing: isWithdrawing || isWithdrawConfirming,
    openTxHash,
    isOpenSuccess,
  };
}