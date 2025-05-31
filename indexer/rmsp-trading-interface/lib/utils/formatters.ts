// Utility functions for formatting data from the indexer

/**
 * Convert BigInt string to number for display
 * @param value BigInt as string from GraphQL
 * @param decimals Number of decimals to divide by (e.g., 18 for standard ETH values, 16 for share percentages)
 * @returns Formatted number
 */
export const formatBigInt = (value: string | null | undefined, decimals: number = 18): number => {
  if (!value) return 0;
  try {
    const bigIntValue = BigInt(value);
    
    // Special handling for share percentages which might be scaled differently
    if (decimals === 16) { // Specifically for shares that are % * 10^18, we divide by 10^16 to get 0-100 value.
      const result = Number(bigIntValue) / Number(BigInt(10**16));
      console.log('formatBigInt (Share %):', { input: value, bigIntValue: bigIntValue.toString(), decimals, result });
      return result;
    }

    // Default handling for other BigInt values
    // Try different decimal scales to see which makes sense for USD or other token values
    if (decimals === 18) {
      const value6Decimals = Number(bigIntValue) / 1e6;
      const value8Decimals = Number(bigIntValue) / 1e8;
      
      if (value6Decimals >= 0.01 && value6Decimals < 1e9 && bigIntValue % BigInt(10**(18-6)) === 0n) {
        // console.log('Using 6 decimals for value:', value, '→', value6Decimals);
        return value6Decimals;
      } else if (value8Decimals >= 0.01 && value8Decimals < 1e9 && bigIntValue % BigInt(10**(18-8)) === 0n) {
        // console.log('Using 8 decimals for value:', value, '→', value8Decimals);
        return value8Decimals;
      }
    }
    
    const divisor = BigInt(10 ** decimals);
    const result = Number(bigIntValue) / Number(divisor);
    
    // if (bigIntValue > 0n) { // General debug log, can be noisy
    //   console.log('formatBigInt (default):', {
    //     input: value,
    //     bigInt: bigIntValue.toString(),
    //     decimals,
    //     divisor: divisor.toString(),
    //     result
    //   });
    // }
    
    return result;
  } catch (error) {
    console.error('Error formatting BigInt:', value, error);
    return 0;
  }
};

/**
 * Format Ethereum address for display
 * @param address Full ethereum address
 * @returns Shortened address format
 */
export const formatAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Calculate PnL percentage
 * @param pnl Profit/Loss as BigInt string
 * @param notional Position size as BigInt string
 * @returns PnL percentage
 */
export const calculatePnlPercent = (pnl: string | null | undefined, notional: string): number => {
  if (!pnl || !notional) return 0;
  const pnlNum = formatBigInt(pnl);
  const notionalNum = formatBigInt(notional);
  if (notionalNum === 0) return 0;
  return (pnlNum / notionalNum) * 100;
};

/**
 * Format timestamp to readable date
 * @param timestamp Unix timestamp
 * @returns Formatted date string
 */
export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString();
};

/**
 * Format BigInt to currency string
 * @param value BigInt as string
 * @param decimals Number of decimals
 * @param currency Currency symbol (default $)
 * @returns Formatted currency string
 */
export const formatCurrency = (
  value: string | null | undefined, 
  decimals: number = 18, 
  currency: string = '$'
): string => {
  const numValue = formatBigInt(value, decimals);
  return `${currency}${numValue.toLocaleString(undefined, { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

/**
 * Format percentage value
 * @param value Percentage value
 * @returns Formatted percentage string
 */
export const formatPercent = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}; 