"use client"

import { useTraders } from "@/lib/hooks/useTraders"
import { formatAddress } from "@/lib/utils/formatters"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccount } from "wagmi"

interface TraderSelectorProps {
  onChange: (traderAddress: string) => void
  selectedTrader?: string
  placeholder?: string
  className?: string
}

export function TraderSelector({ 
  onChange, 
  selectedTrader, 
  placeholder = "Select a trader",
  className
}: TraderSelectorProps) {
  const { traders, loading, error } = useTraders()
  const { address: userAddress, isConnected } = useAccount()

  if (loading) {
    return (
      <div className={className}>
        <Skeleton className="h-10 w-full bg-gray-800/50" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-red-500 text-sm ${className}`}>
        Error loading traders
      </div>
    )
  }

  if (traders.length === 0) {
    return (
      <div className={`text-gray-500 text-sm ${className}`}>
        No traders found
      </div>
    )
  }

  return (
    <Select value={selectedTrader} onValueChange={onChange}>
      <SelectTrigger 
        className={`w-full bg-gray-900/50 border-gray-700 text-gray-100 hover:bg-gray-800/50 focus:ring-gray-600 focus:ring-offset-gray-900 ${className}`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-gray-900 border-gray-700">
        {/* Special "All traders" option */}
        <SelectItem 
          value="all"
          className="text-gray-100 hover:bg-gray-800 focus:bg-gray-800 focus:text-gray-100"
        >
          <div className="flex items-center justify-between w-full">
            <span className="font-medium">All traders</span>
            <span className="ml-3 text-xs text-gray-400">
              {traders.length} total
            </span>
          </div>
        </SelectItem>
        
        {/* "My Trades" option - only show if wallet is connected */}
        {isConnected && userAddress && (
          <SelectItem 
            value={userAddress}
            className="text-gray-100 hover:bg-gray-800 focus:bg-gray-800 focus:text-gray-100 border-b border-gray-700"
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-medium text-blue-400">My Trades</span>
              <span className="ml-3 text-xs text-gray-400">
                {formatAddress(userAddress)}
              </span>
            </div>
          </SelectItem>
        )}
        
        {/* Separator */}
        <div className="h-px bg-gray-700 my-1" />
        
        {/* All other traders */}
        {traders.map((trader) => (
          <SelectItem 
            key={trader.address} 
            value={trader.address}
            className="text-gray-100 hover:bg-gray-800 focus:bg-gray-800 focus:text-gray-100"
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-mono text-sm">
                {formatAddress(trader.address)}
                {trader.address === userAddress && (
                  <span className="ml-2 text-xs text-blue-400">(You)</span>
                )}
              </span>
              {trader.positionCount && (
                <span className="ml-3 text-xs text-gray-400">
                  {trader.positionCount} position{trader.positionCount !== 1 ? 's' : ''}
                  {trader.openPositionCount !== undefined && trader.openPositionCount > 0 && (
                    <span className="text-green-500 ml-1">
                      ({trader.openPositionCount} open)
                    </span>
                  )}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}