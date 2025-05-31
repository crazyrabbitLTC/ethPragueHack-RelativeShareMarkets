"use client"

export interface Token {
  symbol: string
  weight?: number
  currentShare: number
  change24h?: number
  volatility?: number
}

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface ShareTableProps {
  tokens: Token[]
}

export function ShareTable({ tokens }: ShareTableProps) {
  return (
    <div className="bg-gray-900/30 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-lg font-semibold">Asset Share Breakdown</h3>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-gray-800 hover:bg-gray-800/30">
            <TableHead className="text-gray-300">Token</TableHead>
            <TableHead className="text-gray-300">Target Weight</TableHead>
            <TableHead className="text-gray-300">Current Share</TableHead>
            <TableHead className="text-gray-300">24h Δ</TableHead>
            <TableHead className="text-gray-300">Volatility (30d)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map((token) => (
            <TableRow key={token.symbol} className="border-gray-800 hover:bg-gray-800/20 transition-colors">
              <TableCell className="font-semibold">{token.symbol}</TableCell>
              <TableCell className="text-gray-300">{(token.weight ?? 0)}%</TableCell>
              <TableCell className="font-medium">{(token.currentShare ?? 0).toFixed(1)}%</TableCell>
              <TableCell className={`font-medium ${(token.change24h ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                {(token.change24h ?? 0) >= 0 ? "+" : ""}
                {(token.change24h ?? 0).toFixed(2)}%
              </TableCell>
              <TableCell className="text-gray-300">{(token.volatility ?? 0).toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
