"use client"

import { TrendingUp } from "lucide-react"

interface ChartPlaceholderProps {
  baseToken: string
  currentShare: number
}

export function ChartPlaceholder({ baseToken, currentShare }: ChartPlaceholderProps) {
  return (
    <div className="relative w-full aspect-video bg-gray-900/30 rounded-xl border border-gray-800 overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-cyan-900/10 animate-pulse" />

      {/* Chart Content */}
      <div className="relative h-full flex flex-col items-center justify-center space-y-4">
        <TrendingUp className="w-16 h-16 text-gray-600" />
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-gray-300">{baseToken} Market Share Chart</h3>
          <p className="text-gray-500">Real-time dominance tracking</p>
        </div>

        {/* Current Share Indicator */}
        <div className="absolute top-4 right-4 bg-gray-800/80 rounded-lg px-4 py-2 border border-gray-700">
          <div className="text-sm text-gray-400">Current Share</div>
          <div className="text-2xl font-bold text-cyan-400">{currentShare.toFixed(1)}%</div>
        </div>

        {/* 50% Reference Line */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent">
          <div className="absolute left-4 -top-6 text-xs text-yellow-400 bg-gray-900 px-2 py-1 rounded">50% Line</div>
        </div>
      </div>
    </div>
  )
}
