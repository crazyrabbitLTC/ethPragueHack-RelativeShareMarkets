"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import { usePositionManagement } from "../hooks/usePositionManagement"

export interface Position {
  // Make sure this matches the structure used
  side: "long" | "short"
  entryShare: number
  currentShare: number
  pnlUsd: number
  pnlPercent: number
  margin: number
  liquidationDistance: number
  notional: number
}

interface PositionCardProps {
  initialPosition: Position | null
  // onAddCollateralApi: (amount: number) => Promise<void>; // Pass the actual API call
}

export function PositionCard({ initialPosition /*, onAddCollateralApi */ }: PositionCardProps) {
  const {
    position,
    collateralAmount,
    setCollateralAmount,
    isAddingCollateral,
    handleAddCollateral,
    isPositivePnl,
    marginUtilization,
    isNearLiquidation,
  } = usePositionManagement({
    initialPosition,
    // onAddCollateralApi
  })

  if (!position) {
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
    )
  }

  return (
    <div className="bg-gray-900/30 rounded-xl border border-gray-800 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Active Position</h3>
        <div
          className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${position.side === "long" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}
        >
          {position.side === "long" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span className="font-medium capitalize">{position.side}</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Entry Share</span>
          <span>Current Share</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold">{position.entryShare.toFixed(1)}%</span>
          <span className="text-xl font-bold">{position.currentShare.toFixed(1)}%</span>
        </div>
      </div>
      <div
        className={`p-4 rounded-lg border ${isPositivePnl ? "bg-green-900/20 border-green-500/30" : "bg-red-900/20 border-red-500/30"}`}
      >
        <div className="text-center space-y-1">
          <div className="text-sm text-gray-400">Unrealized PnL</div>
          <div className={`text-3xl font-bold ${isPositivePnl ? "text-green-400" : "text-red-400"}`}>
            {isPositivePnl ? "+" : ""}${position.pnlUsd.toLocaleString()}
          </div>
          <div className={`text-lg ${isPositivePnl ? "text-green-400" : "text-red-400"}`}>
            ({isPositivePnl ? "+" : ""}
            {position.pnlPercent.toFixed(2)}%)
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-gray-300">Margin</Label>
          <span className="text-sm font-medium">${position.margin.toLocaleString()}</span>
        </div>
        <Progress value={marginUtilization} className="h-2" />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Used: {marginUtilization.toFixed(1)}%</span>
          <span>Available: {(100 - marginUtilization).toFixed(1)}%</span>
        </div>
      </div>
      {isNearLiquidation && (
        <div className="flex items-center space-x-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
          <span className="text-red-400 font-medium">{position.liquidationDistance.toFixed(1)}% from liquidation</span>
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
          />
          <Button
            onClick={handleAddCollateral}
            disabled={!collateralAmount || Number.parseFloat(collateralAmount) <= 0 || isAddingCollateral}
            variant="outline"
            className="border-gray-600 hover:bg-gray-800"
          >
            {isAddingCollateral ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>
    </div>
  )
}
