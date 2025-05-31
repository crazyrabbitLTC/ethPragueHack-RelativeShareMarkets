// Contract addresses on Arbitrum
export const CONTRACTS = {
  perp: "0x99d45f0d21D135D0947F641Ae4C10E00DF820244" as const,
  oracle: "0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f" as const,
  usdc: "0xe2696990894452AbE9ce45ba557979c2cbc6B3dd" as const,
};

// SimplePerpV2 ABI - only the functions we need
export const SimplePerpV2ABI = [
  // Read functions
  {
    "inputs": [{ "name": "user", "type": "address" }],
    "name": "positions",
    "outputs": [
      { "name": "baseToken", "type": "string" },
      { "name": "quoteToken", "type": "string" },
      { "name": "notional", "type": "uint256" },
      { "name": "isLong", "type": "bool" },
      { "name": "entryShare", "type": "uint256" },
      { "name": "openedAt", "type": "uint256" },
      { "name": "lastUpdated", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "minimumMarginRatio",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "user", "type": "address" }],
    "name": "balances",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Write functions
  {
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "baseToken", "type": "string" },
      { "name": "quoteToken", "type": "string" },
      { "name": "notional", "type": "uint256" },
      { "name": "isLong", "type": "bool" }
    ],
    "name": "openPosition",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "closePosition",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "name": "addCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "name": "removeCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "user", "type": "address" },
      { "indexed": false, "name": "notional", "type": "uint256" },
      { "indexed": false, "name": "collateral", "type": "uint256" },
      { "indexed": false, "name": "isLong", "type": "bool" },
      { "indexed": false, "name": "entryRatio", "type": "uint256" }
    ],
    "name": "PositionOpened",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "user", "type": "address" },
      { "indexed": false, "name": "notional", "type": "uint256" },
      { "indexed": false, "name": "realizedPnL", "type": "int256" },
      { "indexed": false, "name": "exitRatio", "type": "uint256" }
    ],
    "name": "PositionClosed",
    "type": "event"
  }
] as const;

// MockUSDC ABI
export const MockUSDCABI = [
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "to", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// RatioOracle ABI - for reading current ratio
export const RatioOracleABI = [
  {
    "inputs": [
      { "name": "baseToken", "type": "string" },
      { "name": "quoteToken", "type": "string" }
    ],
    "name": "getRatioShare",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "token", "type": "string" }],
    "name": "getPrice",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "lastUpdateTimestamp",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "priceUpdateData", "type": "bytes[]" }],
    "name": "updatePriceFeeds",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "priceUpdateData", "type": "bytes[]" }],
    "name": "getUpdateFee",
    "outputs": [{ "name": "fee", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "useMockPrices",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;