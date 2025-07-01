# Uniswap V4 Hooks: Complete Guide

## Overview

Uniswap V4 introduces **Hooks**, a revolutionary system that allows developers to customize and extend the behavior of liquidity pools. This represents a major architectural improvement over V3, enabling unprecedented protocol customization while maintaining gas efficiency.

## Key Concepts

### What are Hooks?

- **External smart contracts** that can be attached to individual pools
- Each pool can have **one hook** (but a hook can serve infinite pools)
- Hooks intercept and modify execution flow at specific points during pool operations
- They are **optional** - not all pools need hooks
- Specified when creating a new pool via `PoolManager.initialize`

### Architectural Foundation: Singleton Design

Unlike V3 where each pool was a separate contract, V4 uses a **singleton architecture**:
- All pools managed by a single `PoolManager.sol` contract
- Benefits:
  - Pool creation is a state update (not contract deployment)
  - Significant gas savings
  - Multi-hop swaps optimized
  - Flash accounting enabled
  - Native ETH support (no WETH wrapping needed)

## Core Hook Functions

Hooks can implement various functions at different stages of pool operations:

### 1. Initialize Hooks
- `beforeInitialize`: Called before pool initialization
- `afterInitialize`: Called after pool initialization
- Can only be invoked once per pool

### 2. Liquidity Modification Hooks
Extremely granular for security purposes:
- `beforeAddLiquidity` / `afterAddLiquidity`
- `beforeRemoveLiquidity` / `afterRemoveLiquidity`

### 3. Swap Hooks
- `beforeSwap`: Called before swap execution
- `afterSwap`: Called after swap execution

### 4. Donate Hooks
- `beforeDonate` / `afterDonate`
- Customize token donation behavior to LPs

## Hook Permissions System

- Hook contracts specify permissions via their **contract address**
- Permissions encoded in the address determine which functions they implement
- `PoolManager` uses these to determine which hooks to call
- Developers can mix & match - use one or all hook functions

## Key Features Enabled by Hooks

### 1. Dynamic Fees
- Pools can adjust fees up or down dynamically
- No opinionated fee calculation - fully customizable
- Updates can occur per swap, per block, or on custom schedules

### 2. Flash Accounting
- Leverages EIP-1153 Transient Storage
- Balance changes recorded and netted in transient storage
- Users only pay final balance change
- No intermediate token transfers needed

### 3. Custom Accounting
- Alter token amounts for swaps and liquidity
- Implement custom curves beyond xy=k
- Add hook-specific fees
- Create liquidity withdrawal fees

## Innovation Potential

Hooks enable building entirely new DeFi protocols:

1. **Custom AMMs** with different pricing curves
2. **Limit orders** implementation
3. **Yield farming** and liquidity mining protocols
4. **Derivative platforms** built on V4 liquidity
5. **Lending protocols** integrated with pools
6. **Custom oracles** for price feeds
7. **Automated liquidity management**
8. **Fee optimization** strategies

## Development Benefits

- **Lower audit costs**: Bootstrap new protocols using hook designs
- **Faster development**: Leverage existing V4 infrastructure
- **Permissionless execution**: Hooks called by PoolManager
- **Composability**: Build on top of Uniswap's liquidity

## Important Considerations

1. **Liquidity routing**: Creating a hook doesn't guarantee liquidity from Uniswap frontend
2. **Security**: Hooks have significant control over pool behavior
3. **Gas costs**: While optimized, hooks still add computational overhead
4. **Complexity**: Requires understanding V4's architecture

## Technical Implementation

When building hooks:
1. Extend `BaseHook` contract
2. Override `getHookPermissions()` to specify which functions to implement
3. Implement desired hook functions (before/after operations)
4. Deploy to address with correct permission flags
5. Attach to pools during initialization

## Example Use Cases

The documentation provides a "Points Hook" example that:
- Awards points when users swap ETH for a specific token
- Awards points when users add liquidity
- Uses `afterSwap` and `afterAddLiquidity` hooks
- Mints ERC20 points tokens as rewards

This demonstrates how hooks can add gamification and incentive layers directly into the swap lifecycle without external contracts or off-chain tracking.

## Summary

Uniswap V4 hooks represent a paradigm shift in AMM design, moving from rigid protocols to customizable, extensible systems. By combining hooks with the singleton architecture, flash accounting, and other V4 innovations, developers can build sophisticated DeFi applications that were previously impossible or gas-prohibitive. This opens up entirely new design spaces while maintaining the security and efficiency Uniswap is known for.