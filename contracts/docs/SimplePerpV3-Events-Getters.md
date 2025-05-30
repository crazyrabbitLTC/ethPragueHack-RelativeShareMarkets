# SimplePerpV3 Enhanced - Events & Getters Documentation

## 🎯 Overview
The enhanced SimplePerpV3 contract provides comprehensive events and view functions for frontend integration and indexing. This document outlines all available events and getters.

## 📊 Enhanced Events

### Position Lifecycle Events

#### `TradeExecuted`
```solidity
event TradeExecuted(
    address indexed user,
    uint16[] tokenIds,
    int256[] exposureDeltas,
    uint256 requiredMargin,
    uint256 entryRatio,      // NEW: Current ETH/BTC ratio at entry
    uint256 totalNotional,   // NEW: Total position size
    uint256 timestamp
);
```

#### `ExposureUpdated`
```solidity
event ExposureUpdated(
    address indexed user,
    uint16 indexed tokenId,
    int256 oldExposure,      // NEW: Previous exposure
    int256 newExposure,
    int256 delta
);
```

#### `PositionClosed`
```solidity
event PositionClosed(
    address indexed user,
    int256 realizedPnl,
    uint256 closingRatio,    // NEW: ETH/BTC ratio at close
    uint256 timestamp
);
```

### Risk Management Events

#### `MarginUpdated`
```solidity
event MarginUpdated(
    address indexed user,
    uint256 oldMargin,
    uint256 newMargin,
    uint256 marginRatio      // NEW: Health factor in bps
);
```

#### `LiquidationAlert`
```solidity
event LiquidationAlert(
    address indexed user,
    uint256 marginRatio,
    uint256 requiredMargin
);
```

### Protocol State Events

#### `NetExposureUpdated`
```solidity
event NetExposureUpdated(
    uint16 indexed tokenId,
    int256 oldNetExposure,
    int256 newNetExposure
);
```

#### `Deposit` & `Withdraw` (Enhanced)
```solidity
event Deposit(
    address indexed user, 
    uint256 amount, 
    uint256 newBalance,
    uint256 freeMargin,      // NEW: Available margin
    uint256 timestamp
);
```

## 🔍 View Functions / Getters

### User Position Views

#### `getUserPosition` - Complete position snapshot
```solidity
function getUserPosition(address user) returns (
    uint16[] memory tokenIds,
    int256[] memory exposures,
    uint256 totalNotional,
    uint256 marginUsed,
    uint256 freeMargin,
    int256 unrealizedPnl,
    uint256 marginRatio,     // Health factor (10000 = 100%)
    bool isLiquidatable
);
```

#### `getUserExposures` - Vector exposures
```solidity
function getUserExposures(address user) returns (
    uint16[] memory tokenIds,
    int256[] memory exposures
);
```

### Risk Management Views

#### `getMarginRatio` - Position health
```solidity
function getMarginRatio(address user) returns (uint256);
// Returns: 10000 = 100% healthy, <8000 = liquidatable
```

#### `isLiquidatable` - Liquidation check
```solidity
function isLiquidatable(address user) returns (bool);
```

#### `getFreeMargin` - Available collateral
```solidity
function getFreeMargin(address user) returns (uint256);
```

### Protocol Statistics

#### `getProtocolStats` - Global metrics
```solidity
function getProtocolStats() returns (
    uint256 totalDeposits,
    uint256 totalOpenInterest,
    uint256 activeUsers,
    uint256 totalPositions,
    uint256 utilizationRate,  // OI/Deposits in bps
    bool isPaused
);
```

#### `getGlobalExposures` - Net system exposure
```solidity
function getGlobalExposures() returns (
    uint16[] memory activeTokens,
    int256[] memory exposures
);
```

### Token-Specific Metrics

#### `getTokenMetrics` - Per-token statistics
```solidity
function getTokenMetrics(uint16 tokenId) returns (
    int256 netExposure,
    uint256 totalLongExposure,
    uint256 totalShortExposure,
    uint256 openInterest
);
```

### Trade Simulation

#### `simulateOpenPosition` - Pre-trade calculations
```solidity
function simulateOpenPosition(
    address user,
    uint16[] memory tokenIds,
    int256[] memory notionals
) returns (
    uint256 requiredMargin,
    uint256 totalNotional,
    uint256 resultingLeverage,
    bool canOpen
);
```

## 📈 Data for Indexers

### Position Storage
```solidity
struct Position {
    uint256 openTimestamp;
    uint256 entryRatioETHBTC;  // Entry price for PnL
    uint256 totalNotional;
    uint256 marginUsed;
    bool isActive;
}
```

### Key Mappings for Indexing
- `userExposure[user][tokenId]` - Per-user token exposure
- `tokenNetExposure[tokenId]` - Global net exposure
- `positions[user]` - Position metadata
- `balances[user]` - User collateral

## 🔗 Frontend Integration Guide

### Opening a Position
1. Call `simulateOpenPosition()` to check requirements
2. Monitor `TradeExecuted` event for confirmation
3. Track `ExposureUpdated` events for each leg

### Monitoring Positions
1. Poll `getUserPosition()` for complete status
2. Watch `LiquidationAlert` events for risk warnings
3. Use `getMarginRatio()` for health monitoring

### LP Hedging Data
1. Call `getGlobalExposures()` for net system risk
2. Monitor `NetExposureUpdated` events for changes
3. Use `getTokenMetrics()` for per-token breakdown

## 🚨 Constants & Parameters

```solidity
MAX_LEVERAGE = 10               // 10x max leverage
LIQUIDATION_THRESHOLD = 8000    // 80% margin ratio
LIQUIDATION_PENALTY = 500       // 5% penalty
```

## 📝 Example Usage

### Get Complete User State
```javascript
const position = await perp.getUserPosition(userAddress);
const {
    tokenIds,
    exposures,
    totalNotional,
    marginUsed,
    freeMargin,
    unrealizedPnl,
    marginRatio,
    isLiquidatable
} = position;

// Display health
const healthPercent = marginRatio / 100;
const riskLevel = isLiquidatable ? "DANGER" : 
                  marginRatio < 10000 ? "WARNING" : "HEALTHY";
```

### Monitor Global Risk
```javascript
// For LPs to track hedging needs
const [activeTokens, exposures] = await perp.getGlobalExposures();

for (let i = 0; i < activeTokens.length; i++) {
    const tokenId = activeTokens[i];
    const netExposure = exposures[i];
    console.log(`Token ${tokenId}: ${netExposure / 1e6} USD net`);
}
```

This enhanced contract provides all necessary events and getters for building a comprehensive frontend and indexing system for the RMSP protocol.