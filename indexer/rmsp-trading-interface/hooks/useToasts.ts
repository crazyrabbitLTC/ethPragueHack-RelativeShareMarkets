"use client"
import { useState, useCallback, useEffect } from "react"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react" // Keep icons here or pass as props

export interface Toast {
  id: string
  type: "success" | "error" | "warning"
  message: string
  duration?: number
}

let toastId = 0

export function useToasts(defaultDuration = 5000) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback(
    (message: string, type: Toast["type"], duration?: number) => {
      const id = (toastId++).toString()
      setToasts((prev) => [...prev, { id, message, type, duration: duration || defaultDuration }])
    },
    [defaultDuration],
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  useEffect(() => {
    if (toasts.length > 0) {
      const latestToast = toasts[toasts.length - 1]
      const timer = setTimeout(() => {
        removeToast(latestToast.id)
      }, latestToast.duration)
      return () => clearTimeout(timer)
    }
  }, [toasts, removeToast])

  // Demo toast functionality (can be removed or triggered via a global context)
  useEffect(() => {
    const demoTimer = setTimeout(() => {
      addToast("Position opened successfully (demo)", "success")
    }, 3000)
    return () => clearTimeout(demoTimer)
  }, [addToast])

  const getIcon = (type: Toast["type"]) => {
    // This could be part of the Toast component if preferred
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case "error":
        return <XCircle className="w-5 h-5 text-red-400" />
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-400" />
    }
  }

  const getStyles = (type: Toast["type"]) => {
    // This could also be part of the Toast component
    switch (type) {
      case "success":
        return "bg-green-900/20 border-green-500/30 text-green-400"
      case "error":
        return "bg-red-900/20 border-red-500/30 text-red-400"
      case "warning":
        return "bg-yellow-900/20 border-yellow-500/30 text-yellow-400"
    }
  }

  return { toasts, addToast, removeToast, getIcon, getStyles }
}
