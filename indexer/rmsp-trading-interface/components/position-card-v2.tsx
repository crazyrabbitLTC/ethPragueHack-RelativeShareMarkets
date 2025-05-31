"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import { useState, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useUserPosition, useCurrentRatio, useTrading, useUSDC } from '@/lib/hooks/useContracts'
import { formatUnits } from 'viem'

export function PositionCardV2() {
  const { isConnected } = useAccount();
  const { position, isLoading: positionLoading } = useUserPosition();
  const { ratio, ratioPercent } = useCurrentRatio();
  const { closePosition, addCollateral, isClosing, isAddingCollateral } = useTrading();
  const { balanceFormatted } = useUSDC();
  
  const [collateralAmount, setCollateralAmount] = useState('');

  // Calculate position metrics
  const positionMetrics = useMemo(() => {
    if (!position.hasPosition) return null;

    const notionalFormatted = parseFloat(formatUnits(position.notional, 6));
    const collateralFormatted = parseFloat(formatUnits(position.collateral, 6));
    const entryRatioPercent = Number(position.entryRatio) / 1e16;
    const currentRatioPercent = ratioPercent;
    
    // Calculate PnL based on ratio change
    const ratioChange = position.isLong 
      ? (currentRatioPercent - entryRatioPercent) / entryRatioPercent
      : (entryRatioPercent - currentRatioPercent) / entryRatioPercent;
    
    const pnlUsd = notionalFormatted * ratioChange;
    const pnlPercent = ratioChange * 100;
    
    // Calculate margin metrics
    const currentValue = notionalFormatted + pnlUsd;
    const marginUsed = Math.abs(currentValue) - collateralFormatted;
    const marginUtilization = (marginUsed / collateralFormatted) * 100;
    
    // Estimate liquidation distance (simplified)
    const liquidationRatio = position.isLong 
      ? entryRatioPercent * 0.8 // 20% drop
      : entryRatioPercent * 1.2; // 20% rise
    
    const liquidationDistance = position.isLong
      ? ((currentRatioPercent - liquidationRatio) / currentRatioPercent) * 100
      : ((liquidationRatio - currentRatioPercent) / currentRatioPercent) * 100;

    return {
      notionalFormatted,
      collateralFormatted,
      entryRatioPercent,
      currentRatioPercent,
      pnlUsd,
      pnlPercent,
      marginUtilization: Math.max(0, Math.min(100, marginUtilization)),
      liquidationDistance: Math.max(0, liquidationDistance),
      isPositivePnl: pnlUsd >= 0,
      isNearLiquidation: liquidationDistance < 10,
    };
  }, [position, ratioPercent]);

  const handleAddCollateral = async () => {
    if (!collateralAmount || parseFloat(collateralAmount) <= 0) return;
    await addCollateral(collateralAmount);
    setCollateralAmount('');
  };

  const handleClosePosition = async () => {
    if (window.confirm('Are you sure you want to close this position?')) {
      await closePosition();
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-gray-900/30 rounded-xl border border-gray-800 p-6 flex flex-col items-center justify-center space-y-4 min-h-[400px]">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-300">Connect Wallet</h3>
          <p className="text-gray-500">Connect your wallet to view positions</p>
        </div>
      </div>
    );
  }

  if (positionLoading) {
    return (
      <div className="bg-gray-900/30 rounded-xl border border-gray-800 p-6 flex flex-col items-center justify-center space-y-4 min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        <p className="text-gray-500">Loading position...</p>
      </div>
    );
  }

  if (!position.hasPosition || !positionMetrics) {
    return (
      <div className="bg-gray-900/30 rounded-xl border border-gray-800 p-6 flex flex-col items-center justify-center space-y-4 min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-gray-600" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-gray-300">No Open Position</h3>
          <p className="text-gray-500">Open a position to start trading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/30 rounded-xl border border-gray-800 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Active Position</h3>
        <div
          className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${
            position.isLong ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
          }`}
        >
          {position.isLong ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span className="font-medium capitalize">{position.isLong ? 'Long' : 'Short'}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Entry Share</span>
          <span>Current Share</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold">{positionMetrics.entryRatioPercent.toFixed(2)}%</span>
          <span className="text-xl font-bold">{positionMetrics.currentRatioPercent.toFixed(2)}%</span>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Notional:</span>
          <span>${positionMetrics.notionalFormatted.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Collateral:</span>
          <span>${positionMetrics.collateralFormatted.toFixed(2)}</span>
        </div>
      </div>

      <div
        className={`p-4 rounded-lg border ${
          positionMetrics.isPositivePnl 
            ? "bg-green-900/20 border-green-500/30" 
            : "bg-red-900/20 border-red-500/30"
        }`}
      >
        <div className="text-center space-y-1">
          <div className="text-sm text-gray-400">Unrealized PnL</div>
          <div className={`text-3xl font-bold ${
            positionMetrics.isPositivePnl ? "text-green-400" : "text-red-400"
          }`}>
            {positionMetrics.isPositivePnl ? "+" : ""}${Math.abs(positionMetrics.pnlUsd).toFixed(2)}
          </div>
          <div className={`text-lg ${
            positionMetrics.isPositivePnl ? "text-green-400" : "text-red-400"
          }`}>
            ({positionMetrics.isPositivePnl ? "+" : ""}{positionMetrics.pnlPercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-gray-300">Margin Utilization</Label>
          <span className="text-sm font-medium">{positionMetrics.marginUtilization.toFixed(1)}%</span>
        </div>
        <Progress value={positionMetrics.marginUtilization} className="h-2" />
      </div>

      {positionMetrics.isNearLiquidation && (
        <div className="flex items-center space-x-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
          <span className="text-red-400 font-medium">
            {positionMetrics.liquidationDistance.toFixed(1)}% from liquidation
          </span>
        </div>
      )}

      <div className="space-y-3 pt-4 border-t border-gray-800">
        <Label className="text-gray-300">Add Collateral</Label>
        <div className="flex space-x-2">
          <Input
            type="number"
            placeholder="Amount (USDC)"
            value={collateralAmount}
            onChange={(e) => setCollateralAmount(e.target.value)}
            className="bg-gray-800 border-gray-700 text-white"
            disabled={isAddingCollateral}
          />
          <Button
            onClick={handleAddCollateral}
            disabled={!collateralAmount || parseFloat(collateralAmount) <= 0 || isAddingCollateral || parseFloat(collateralAmount) > parseFloat(balanceFormatted)}
            variant="outline"
            className="border-gray-600 hover:bg-gray-800"
          >
            {isAddingCollateral ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>

      <Button
        onClick={handleClosePosition}
        disabled={isClosing}
        variant="destructive"
        className="w-full"
      >
        {isClosing ? "Closing Position..." : "Close Position"}
      </Button>
    </div>
  );
}