"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useOrderForm } from "../hooks/useOrderForm" // Ensure OrderSide is exported
import type { Token } from "./share-table" // Assuming Token type is exported or defined globally
// import type { Position } from "./position-card"; // If onSubmitSuccess returns a Position

interface OrderFormProps {
  baseToken: string
  basketTokens: Token[] // Kept for potential future use, not directly used by hook currently
  // onSubmitSuccess?: (newPosition: Position) => void; // Callback for successful order
}

export function OrderForm({ baseToken, basketTokens }: OrderFormProps) {
  const {
    side,
    setSide,
    notional,
    setNotional,
    leverage,
    setLeverage,
    isSubmitting,
    notionalValue,
    initialMargin,
    liquidationPrice,
    handleSubmit,
    orderButtonText,
  } = useOrderForm({ baseToken })

  const handleFormSubmit = async () => {
    await handleSubmit()
    // if (onSubmitSuccess && !isSubmitting) { // Check isSubmitting if it's not reset in hook
    //   // This is a placeholder. The actual new position data would come from the API response
    //   // onSubmitSuccess({ ...mockPositionData, side, notional: notionalValue, leverage: leverage[0] });
    // }
  }

  return (
    <div className="bg-gray-900/30 rounded-xl border border-gray-800 p-6 space-y-6">
      <h3 className="text-lg font-semibold">Open Position</h3>
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
            <span className="font-medium text-red-400">{liquidationPrice}%</span>
          </div>
        </div>
      )}
      <Button
        onClick={handleFormSubmit}
        disabled={!notionalValue || isSubmitting}
        className={`w-full h-12 font-semibold ${side === "long" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} ${isSubmitting ? "animate-pulse" : ""}`}
      >
        {orderButtonText}
      </Button>
    </div>
  )
}
