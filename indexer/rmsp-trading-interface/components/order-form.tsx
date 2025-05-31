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
    // Get the basket tokens as a comma-separated string
    const quoteTokens = basketTokens.map(t => t.symbol).join(',');
    await openPosition(notional, side === 'long', baseToken, quoteTokens);
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
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Open Position</h3>
        {isConnected && (
          <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-3 py-1.5">
            <span className="text-sm text-gray-400">
              Balance: <span className="text-white font-medium">${parseFloat(balanceFormatted).toFixed(2)}</span>
            </span>
            {balance === 0n && (
              <Button
                size="sm"
                onClick={airdrop}
                disabled={isAirdropping}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
              >
                {isAirdropping ? "Airdropping..." : "Get Test USDC"}
              </Button>
            )}
            {needsApproval && balance > 0n && (
              <Button
                size="sm"
                onClick={approveMax}
                disabled={isApproving}
                className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-500"
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
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-cyan-400">{leverage[0].toFixed(1)}×</span>
            <span className="text-sm text-gray-400">
              (Margin: ${(notionalValue / leverage[0]).toFixed(2)})
            </span>
          </div>
        </div>
        <Slider 
          value={leverage} 
          onValueChange={setLeverage} 
          max={3} 
          min={1} 
          step={0.5} 
          className="w-full" 
        />
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Conservative</span>
          <span className="text-gray-400">Moderate</span>
          <span className="text-gray-400">Aggressive</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {[1, 1.5, 2, 2.5, 3].map((lev) => (
            <button
              key={lev}
              onClick={() => setLeverage([lev])}
              className={`p-2 text-sm rounded border transition-all ${
                leverage[0] === lev 
                  ? 'bg-cyan-600 text-white border-cyan-500' 
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
              }`}
            >
              {lev}×
            </button>
          ))}
        </div>
      </div>
      {notionalValue > 0 && (
        <div className="space-y-2 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Position Size:</span>
            <span className="font-medium">${notionalValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Required Margin:</span>
            <span className="font-medium text-cyan-400">${initialMargin.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Liquidation at:</span>
            <span className="font-medium text-red-400">~{((1 - 1/leverageValue) * 100).toFixed(1)}% loss</span>
          </div>
          <div className="mt-2 p-2 bg-gray-900/50 rounded text-xs text-gray-400">
            💡 Leverage {leverageValue}× means you control ${notionalValue.toFixed(0)} worth of position with just ${initialMargin.toFixed(0)} margin
          </div>
          {hasInsufficientBalance && (
            <div className="text-xs text-yellow-400 mt-2">
              ⚠️ Insufficient balance. You need ${(notionalValue - parseFloat(balanceFormatted)).toFixed(2)} more USDC.
            </div>
          )}
        </div>
      )}
      {position.hasPosition && (
        <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-400">
            ⚠️ You already have an open position. Please close it first before opening a new one.
          </p>
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
