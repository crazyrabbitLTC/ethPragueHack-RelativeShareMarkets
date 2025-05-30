"use client"
import { useState, useCallback } from "react"

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

  const notionalValue = Number.parseFloat(notional) || 0
  const leverageValue = leverage[0]

  // These calculations could also be moved to a utility if they become complex
  const initialMargin = notionalValue > 0 && leverageValue > 0 ? notionalValue / leverageValue : 0
  // Mock calculation, replace with actual logic
  const liquidationPrice = notionalValue > 0 ? (side === "long" ? 35.2 : 48.7) : 0

  const handleSubmit = useCallback(async () => {
    if (!notionalValue || leverageValue <= 0) return
    setIsSubmitting(true)
    // console.log("Submitting order:", { side, notional: notionalValue, leverage: leverageValue });
    // await onSubmitOrder({ side, notional: notionalValue, leverage: leverageValue });
    await new Promise((resolve) => setTimeout(resolve, 2000)) // Simulate API call
    setIsSubmitting(false)
    // Potentially reset form or show success toast
  }, [side, notionalValue, leverageValue /*, onSubmitOrder */])

  const orderButtonText = isSubmitting
    ? "Opening Position..."
    : `Open ${side === "long" ? "Long" : "Short"} ${baseToken} Position`

  return {
    side,
    setSide,
    notional,
    setNotional,
    leverage,
    setLeverage,
    isSubmitting,
    notionalValue,
    leverageValue,
    initialMargin,
    liquidationPrice,
    handleSubmit,
    orderButtonText,
  }
}
