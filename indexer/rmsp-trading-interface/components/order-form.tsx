"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useAccount } from 'wagmi'
import { useUSDC, useTrading, useUserPosition } from '@/lib/hooks/useContracts'
import { useState } from 'react'
import type { Token } from "./share-table"

interface OrderFormProps {
  baseToken: string
  basketTokens: Token[] // Kept for potential future use, not directly used by hook currently
  // onSubmitSuccess?: (newPosition: Position) => void; // Callback for successful order
}

export function OrderForm({ baseToken, basketTokens }: OrderFormProps) {
  const { isConnected } = useAccount();
  const { 
    balance, 
    balanceFormatted, 
    needsApproval, 
    airdrop, 
    approveMax, 
    isAirdropping,
    isApproving 
  } = useUSDC();
  const { openPosition, isOpening } = useTrading();
  const { position } = useUserPosition();
  
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [notional, setNotional] = useState('');
  const [leverage, setLeverage] = useState([1]);

  const notionalValue = parseFloat(notional) || 0;
  const leverageValue = leverage[0];
  const initialMargin = notionalValue / leverageValue;
  const hasInsufficientBalance = notionalValue > parseFloat(balanceFormatted);

  const handleSubmit = async () => {
    if (!notional || notionalValue <= 0) return;
    await openPosition(notional, side === 'long');
  };

  const getButtonText = () => {
    if (!isConnected) return "Connect Wallet";
    if (position.hasPosition) return "Close Existing Position First";
    if (hasInsufficientBalance) return "Insufficient Balance";
    if (needsApproval) return "Approve USDC First";
    if (isOpening) return "Opening Position...";
    return `Open ${side === 'long' ? 'Long' : 'Short'} ${baseToken} Position`;
  };

  const isButtonDisabled = !isConnected || position.hasPosition || hasInsufficientBalance || needsApproval || isOpening || !notional;

  return (
    <div className="bg-gray-900/30 rounded-xl border border-gray-800 p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Open Position</h3>
        {isConnected && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              Balance: <span className="text-white font-medium">{parseFloat(balanceFormatted).toFixed(2)} USDC</span>
            </span>
            {balance === 0n && (
              <Button
                size="sm"
                variant="outline"
                onClick={airdrop}
                disabled={isAirdropping}
                className="text-xs"
              >
                {isAirdropping ? "Airdropping..." : "Get Test USDC"}
              </Button>
            )}
            {needsApproval && balance > 0n && (
              <Button
                size="sm"
                variant="outline"
                onClick={approveMax}
                disabled={isApproving}
                className="text-xs"
              >
                {isApproving ? "Approving..." : "Approve USDC"}
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label className="text-gray-300">Side</Label>
        <div className="flex space-x-2">
          <Button
            variant={side === "long" ? "default" : "outline"}
            onClick={() => setSide("long")}
            className={`flex-1 ${side === "long" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-green-900/60 hover:bg-green-800/70 text-gray-400 border-green-700/50"}`}
          >
            Long {baseToken}
          </Button>
          <Button
            variant={side === "short" ? "default" : "outline"}
            onClick={() => setSide("short")}
            className={`flex-1 ${side === "short" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-red-900/60 hover:bg-red-800/70 text-gray-400 border-red-700/50"}`}
          >
            Short {baseToken}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-gray-300">Notional (USDC)</Label>
        <Input
          type="number"
          placeholder="0.00"
          value={notional}
          onChange={(e) => setNotional(e.target.value)}
          className="bg-gray-800 border-gray-700 text-white"
        />
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-gray-300">Leverage</Label>
          <span className="text-lg font-bold text-cyan-400">{leverage[0]}×</span>
        </div>
        <Slider value={leverage} onValueChange={setLeverage} max={3} min={1} step={0.1} className="w-full" />
        <div className="flex justify-between text-xs text-gray-500">
          <span>1×</span>
          <span>2×</span>
          <span>3×</span>
        </div>
      </div>
      {notionalValue > 0 && (
        <div className="space-y-2 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Initial Margin:</span>
            <span className="font-medium">${initialMargin.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Est. Liquidation:</span>
            <span className="font-medium text-red-400">~{((1 - 1/leverageValue) * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}
      <Button
        onClick={handleSubmit}
        disabled={isButtonDisabled}
        className={`w-full h-12 font-semibold ${side === "long" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} ${isOpening ? "animate-pulse" : ""}`}
      >
        {getButtonText()}
      </Button>
    </div>
  )
}
