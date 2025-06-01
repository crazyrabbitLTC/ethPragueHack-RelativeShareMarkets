"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { CONTRACTS, RatioOracleABI } from '@/lib/contracts/abis'
import { useToast } from '@/hooks/use-toast'
import { useEffect, useState } from 'react'

// Pyth price IDs for tokens (Arbitrum mainnet)
const PRICE_IDS: Record<string, string> = {
  'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'BTC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
};

async function fetchPythPriceUpdates(tokens: string[]) {
  try {
    const priceIds = tokens.map(token => PRICE_IDS[token] || PRICE_IDS['ETH']);
    const uniquePriceIds = [...new Set(priceIds)];
    
    // Fetch price updates from Pyth Hermes API
    const response = await fetch(`https://hermes.pyth.network/api/latest_price_feeds?${uniquePriceIds.map(id => `ids[]=${id}`).join('&')}&binary=true`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch price updates: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Check if we got the expected response format
    if (data && data.length > 0 && data[0].price) {
      // The response contains price data but we need the binary update data
      // For now, return mock data to avoid errors
      console.warn('Pyth API response format not as expected, using mock data');
      return {
        updateData: ['0x504e41560000000000000000'], // Mock VAA data
        updateFee: BigInt(1)
      };
    }
    
    // If we have binary data, use it
    if (data && data.binary && data.binary.data) {
      return {
        updateData: data.binary.data,
        updateFee: BigInt(data.binary.data.length)
      };
    }
    
    // Fallback: try to get VAA data from the response
    const updateData: string[] = [];
    
    for (const priceData of data) {
      if (priceData.vaa) {
        // Convert base64 VAA to hex
        try {
          const base64 = priceData.vaa;
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const hex = '0x' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
          updateData.push(hex);
        } catch (e) {
          console.error('Error converting VAA:', e);
        }
      }
    }
    
    if (updateData.length === 0) {
      throw new Error('No valid price updates found in response');
    }
    
    return {
      updateData,
      updateFee: BigInt(updateData.length)
    };
  } catch (error) {
    console.error('Error fetching Pyth price updates:', error);
    throw error;
  }
}

export function PriceUpdateButton() {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Check if using mock prices
  const { data: useMockPrices } = useReadContract({
    address: CONTRACTS.oracle,
    abi: RatioOracleABI,
    functionName: 'useMockPrices',
  });
  
  // Price update contract call
  const { 
    writeContract: updatePrices, 
    data: updateTxHash,
    isPending: isWriting,
    error: updateError
  } = useWriteContract();
  
  // Wait for transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: updateTxHash,
  });
  
  // Handle transaction status
  useEffect(() => {
    if (updateTxHash) {
      toast({
        title: "Updating Oracle Prices...",
        description: `Transaction submitted - View on Arbiscan: https://arbiscan.io/tx/${updateTxHash}`,
      });
    }
  }, [updateTxHash, toast]);
  
  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Prices Updated! ✅",
        description: "Oracle now has fresh price data. You can trade normally.",
      });
      setIsUpdating(false);
    }
  }, [isSuccess, toast]);
  
  useEffect(() => {
    if (updateError) {
      toast({
        title: "Update Failed ❌",
        description: updateError.message || "Failed to update prices",
        variant: "destructive",
      });
      setIsUpdating(false);
    }
  }, [updateError, toast]);
  
  const handleUpdate = async () => {
    // Check if oracle is in mock mode
    if (useMockPrices) {
      toast({
        title: "Oracle in Mock Mode",
        description: "Run ./activate-pyth-now.sh to switch to real Pyth prices!",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsUpdating(true);
      
      // Fetch VAAs from Pyth
      const priceIds = [PRICE_IDS.ETH, PRICE_IDS.BTC];
      const url = `https://hermes.pyth.network/api/latest_vaas?ids[]=${priceIds[0]}&ids[]=${priceIds[1]}`;
      
      console.log('Fetching price updates from:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch prices from Pyth');
      }
      
      const data = await response.json();
      
      if (!data || data.length === 0) {
        throw new Error('No price data available from Pyth');
      }
      
      // Convert VAAs to update data format
      const updateData = data.map((vaaItem: any) => {
        // Debug log to see what we're getting
        console.log('VAA item:', vaaItem);
        
        // Handle different response formats from Pyth
        let base64Vaa;
        if (typeof vaaItem === 'string') {
          // If it's already a string, use it directly
          base64Vaa = vaaItem;
        } else if (vaaItem && vaaItem.vaa) {
          // If it's an object with vaa property
          base64Vaa = vaaItem.vaa;
        } else if (vaaItem && vaaItem.data) {
          // Sometimes it's in a data property
          base64Vaa = vaaItem.data;
        } else {
          console.error('Invalid VAA format:', vaaItem);
          throw new Error('Invalid VAA data format');
        }
        
        // Convert base64 to hex
        try {
          const binaryString = atob(base64Vaa);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return '0x' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
          console.error('Error decoding base64:', e);
          throw new Error('Failed to decode VAA data');
        }
      });
      
      console.log('Got', updateData.length, 'price updates');
      
      // Update prices on-chain
      updatePrices({
        address: CONTRACTS.oracle,
        abi: RatioOracleABI,
        functionName: 'updatePriceFeeds',
        args: [updateData],
        value: BigInt(updateData.length), // 1 wei per price update
      });
      
    } catch (error) {
      console.error('Price update error:', error);
      toast({
        title: "Failed to fetch prices",
        description: "Could not get latest price data from Pyth. Try again.",
        variant: "destructive",
      });
      setIsUpdating(false);
    }
  };
  
  // Always show the button so users know about the feature
  // if (useMockPrices) {
  //   return null;
  // }
  
  const isLoading = isUpdating || isWriting || isConfirming;
  
  return (
    <Button
      onClick={handleUpdate}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2 bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
      title={useMockPrices ? "Oracle is in mock mode - prices don't need updating" : "Update oracle prices from Pyth"}
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? "Updating..." : useMockPrices ? "Mock Mode Active" : "Update Oracle Prices"}
    </Button>
  );
}