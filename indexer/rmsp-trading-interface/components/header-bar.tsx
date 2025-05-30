"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Wifi, WifiOff } from "lucide-react"

interface HeaderBarProps {
  blockNumber: number
  isConnected: boolean
  onConnect: () => void
}

export function HeaderBar({ blockNumber, isConnected, onConnect }: HeaderBarProps) {
  const [pulseKey, setPulseKey] = useState(0)

  useEffect(() => {
    setPulseKey((prev) => prev + 1)
  }, [blockNumber])

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-[#0d1117]/95 backdrop-blur-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-4">
          <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            RMSP
          </div>
        </div>

        {/* Status & Connect */}
        <div className="flex items-center space-x-4">
          {/* Block Number */}
          <div key={pulseKey} className="flex items-center space-x-2 text-sm text-gray-300 animate-pulse">
            <span>Block #{blockNumber.toLocaleString()}</span>
          </div>

          {/* Oracle Status */}
          <div className="flex items-center space-x-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            <span className="text-gray-300">Oracle: {isConnected ? "Live" : "Offline"}</span>
            {isConnected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
          </div>

          {/* Wallet Connect */}
          <Button
            onClick={onConnect}
            variant={isConnected ? "outline" : "default"}
            className={`relative ${isConnected ? "border-green-500 text-green-400" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            <div
              className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"} animate-pulse`}
            />
            {isConnected ? "Connected" : "Connect Wallet"}
          </Button>
        </div>
      </div>
    </header>
  )
}
