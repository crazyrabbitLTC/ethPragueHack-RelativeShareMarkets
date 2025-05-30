"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { placeholderTradingPairs, type TradingPair } from "../data/trading-pairs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export function TradingPairSelector() {
  const [selectedPair, setSelectedPair] = useState<TradingPair>(placeholderTradingPairs[0])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center space-x-2 bg-gray-900/50 rounded-lg px-4 py-2 h-auto border border-gray-700 hover:bg-gray-800/70 hover:border-gray-600 text-white text-left"
        >
          <span className="text-lg font-semibold">{selectedPair.fullLabel}</span>
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-gray-900 border-gray-700 text-white w-56">
        {placeholderTradingPairs.map((pair) => (
          <DropdownMenuItem
            key={pair.id}
            onClick={() => setSelectedPair(pair)}
            className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer py-2 px-3"
          >
            {pair.fullLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
