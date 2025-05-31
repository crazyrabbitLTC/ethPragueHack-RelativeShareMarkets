"use client"
import { useState, useCallback, useMemo } from "react"

export type OrderSide = "long" | "short"

export interface UseOrderFormProps {
  initialSide?: OrderSide
  initialLeverage?: number
  baseToken: string // Needed for display text, pass if dynamic
  // Add any API submission functions or services here
  // onSubmitOrder: (data: OrderFormData) => Promise<void>;
}

export interface OrderFormData {
  side: OrderSide
  notional: number
  leverage: number
}

export function useOrderForm({ initialSide = "long", initialLeverage = 1, baseToken }: UseOrderFormProps) {
  const [side, setSide] = useState<OrderSide>(initialSide)
  const [notional, setNotional] = useState("")
  const [leverage, setLeverage] = useState([initialLeverage])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Memoize computed values to prevent unnecessary re-renders
  const notionalValue = useMemo(() => Number.parseFloat(notional) || 0, [notional])
  const leverageValue = useMemo(() => leverage[0], [leverage])

  // Memoize calculations to prevent re-computation on every render
  const initialMargin = useMemo(() => {
    return notionalValue > 0 && leverageValue > 0 ? notionalValue / leverageValue : 0
  }, [notionalValue, leverageValue])

  // Mock calculation, replace with actual logic
  const liquidationPrice = useMemo(() => {
    return notionalValue > 0 ? (side === "long" ? 35.2 : 48.7) : 0
  }, [notionalValue, side])

  // Stable callback for leverage updates to prevent Slider re-renders
  const handleLeverageChange = useCallback((value: number[]) => {
    setLeverage(value)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!notionalValue || leverageValue <= 0) return
    setIsSubmitting(true)
    // console.log("Submitting order:", { side, notional: notionalValue, leverage: leverageValue });
    // await onSubmitOrder({ side, notional: notionalValue, leverage: leverageValue });
    await new Promise((resolve) => setTimeout(resolve, 2000)) // Simulate API call
    setIsSubmitting(false)
    // Potentially reset form or show success toast
  }, [side, notionalValue, leverageValue /*, onSubmitOrder */])

  const orderButtonText = useMemo(() => {
    return isSubmitting
      ? "Opening Position..."
      : `Open ${side === "long" ? "Long" : "Short"} ${baseToken} Position`
  }, [isSubmitting, side, baseToken])

  return {
    side,
    setSide,
    notional,
    setNotional,
    leverage,
    setLeverage: handleLeverageChange,
    isSubmitting,
    notionalValue,
    leverageValue,
    initialMargin,
    liquidationPrice,
    handleSubmit,
    orderButtonText,
  }
}
