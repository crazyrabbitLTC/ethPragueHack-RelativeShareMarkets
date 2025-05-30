"use client"

import { useToasts } from "../hooks/useToasts" // Ensure Toast is exported

export function ToastStack() {
  const { toasts, removeToast, getIcon, getStyles } = useToasts()

  if (!toasts.length) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center space-x-3 p-4 rounded-lg border backdrop-blur-sm animate-in slide-in-from-right ${getStyles(toast.type)} cursor-pointer`}
          onClick={() => removeToast(toast.id)}
          role="alert"
          aria-live="assertive"
        >
          {getIcon(toast.type)}
          <span className="font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
