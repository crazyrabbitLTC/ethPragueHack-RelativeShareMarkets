"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { AlertTriangle, RefreshCw, Settings } from "lucide-react"
import { useState } from "react"
import { useOracleAdmin } from "@/lib/hooks/useOracleAdmin"
import { useAccount } from "wagmi"

export function AdminTools() {
  const { isConnected } = useAccount();
  const { 
    updateOraclePrice, 
    updateWithCurrentMarketPrices,
    isUpdating, 
    isOwner, 
    lastUpdate, 
    currentRatioPercent,
    isStale 
  } = useOracleAdmin();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [customEthPrice, setCustomEthPrice] = useState("2542.47");
  const [customBtcPrice, setCustomBtcPrice] = useState("104710.62");

  if (!isConnected) return null;

  return (
    <Card className="bg-gray-900/30 border-gray-800">
      <div className="p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-300">Demo Admin Tools</h3>
            {isStale && (
              <div className="flex items-center gap-1 text-xs text-yellow-400">
                <AlertTriangle className="w-3 h-3" />
                <span>Oracle Stale</span>
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {isExpanded ? "−" : "+"}
          </span>
        </button>
        
        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* Oracle Status */}
            <div className="p-3 bg-gray-800/30 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Oracle Status</span>
                <div className={`text-xs px-2 py-1 rounded ${isStale ? 'bg-yellow-900/30 text-yellow-400' : 'bg-green-900/30 text-green-400'}`}>
                  {isStale ? 'Stale' : 'Fresh'}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Last Update: {lastUpdate ? lastUpdate.toLocaleString() : 'Never'}
              </div>
              <div className="text-xs text-gray-500">
                Current ETH Share: {currentRatioPercent.toFixed(2)}%
              </div>
            </div>

            {/* Quick Update Button */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Quick Actions</Label>
              <Button
                onClick={updateWithCurrentMarketPrices}
                disabled={isUpdating || !isOwner}
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2" />
                    Update Oracle (Current Prices)
                  </>
                )}
              </Button>
              {!isOwner && (
                <p className="text-xs text-yellow-400">
                  ⚠️ Only contract owner can update oracle
                </p>
              )}
            </div>

            {/* Custom Price Update */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Custom Price Update</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    type="number"
                    placeholder="ETH Price"
                    value={customEthPrice}
                    onChange={(e) => setCustomEthPrice(e.target.value)}
                    className="text-xs h-8 bg-gray-800 border-gray-700"
                  />
                  <span className="text-xs text-gray-500">ETH/USD</span>
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="BTC Price"
                    value={customBtcPrice}
                    onChange={(e) => setCustomBtcPrice(e.target.value)}
                    className="text-xs h-8 bg-gray-800 border-gray-700"
                  />
                  <span className="text-xs text-gray-500">BTC/USD</span>
                </div>
              </div>
              <Button
                onClick={() => updateOraclePrice(customEthPrice, customBtcPrice)}
                disabled={isUpdating || !isOwner || !customEthPrice || !customBtcPrice}
                size="sm"
                variant="outline"
                className="w-full text-xs"
              >
                Update with Custom Prices
              </Button>
            </div>

            {/* Test Wallets Info */}
            <div className="p-3 bg-gray-800/30 rounded-lg space-y-1">
              <p className="text-xs font-medium text-gray-400">Test Wallets with Positions:</p>
              <p className="text-xs text-gray-500">Alice: 0xc4F3...41D1 (Long ETH)</p>
              <p className="text-xs text-gray-500">Bob: 0xA34d...9e2B (Short ETH)</p>
              <p className="text-xs text-orange-400 mt-2">
                💡 Update oracle to allow position closes
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}