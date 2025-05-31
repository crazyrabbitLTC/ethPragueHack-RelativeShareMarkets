"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import { placeholderTradingPairs, type TradingPair } from "../data/trading-pairs"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function TradingPairSelector() {
  const [selectedPair, setSelectedPair] = useState<TradingPair>(placeholderTradingPairs[0])
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (pair: TradingPair) => {
    setSelectedPair(pair)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-gray-900/50 rounded-lg px-4 py-2 h-auto border border-gray-700 hover:bg-gray-800/70 hover:border-gray-600 text-white text-left"
      >
        <span className="text-lg font-semibold">{selectedPair.fullLabel}</span>
        <ChevronDown className={cn("w-5 h-5 text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </Button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-50">
          {placeholderTradingPairs.map((pair) => (
            <button
              key={pair.id}
              onClick={() => handleSelect(pair)}
              className={cn(
                "w-full text-left px-3 py-2 text-white hover:bg-gray-800 focus:bg-gray-800 focus:outline-none transition-colors",
                "first:rounded-t-md last:rounded-b-md",
                selectedPair.id === pair.id && "bg-gray-800"
              )}
            >
              {pair.fullLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
