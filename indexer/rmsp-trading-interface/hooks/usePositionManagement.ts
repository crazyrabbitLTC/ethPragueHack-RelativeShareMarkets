"use client"
import { useState, useCallback } from "react"
import type { Position } from "@/components/position-card" // Assuming Position type is exported

export interface UsePositionManagementProps {
  initialPosition: Position | null
  // onAddCollateralApi: (amount: number) => Promise<void>;
}

export function usePositionManagement({ initialPosition /*, onAddCollateralApi */ }: UsePositionManagementProps) {
  const [position, setPosition] = useState<Position | null>(initialPosition)
  const [collateralAmount, setCollateralAmount] = useState("")
  const [isAddingCollateral, setIsAddingCollateral] = useState(false)

  const handleAddCollateral = useCallback(async () => {
    const amount = Number.parseFloat(collateralAmount)
    if (amount <= 0 || !position) return

    setIsAddingCollateral(true)
    // await onAddCollateralApi(amount);
    await new Promise((resolve) => setTimeout(resolve, 1500)) // Simulate API call

    setPosition((prev) => (prev ? { ...prev, margin: prev.margin + amount } : null))
    setCollateralAmount("")
    setIsAddingCollateral(false)
    // Show success toast
  }, [collateralAmount, position /*, onAddCollateralApi */])

  // Derived state for the position card
  const isPositivePnl = position ? position.pnlUsd >= 0 : false
  const marginUtilization =
    position && position.notional > 0 ? ((position.notional - position.margin) / position.notional) * 100 : 0
  const isNearLiquidation = position ? position.liquidationDistance < 10 : false

  return {
    position,
    collateralAmount,
    setCollateralAmount,
    isAddingCollateral,
    handleAddCollateral,
    isPositivePnl,
    marginUtilization,
    isNearLiquidation,
    // Expose setPosition if external updates are needed, e.g., after an order fills
    // setPosition,
  }
}
