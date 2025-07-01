# Uniswap V4 Hooks: Complete Technical Deep Dive

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Hook Lifecycle & Entry Points](#hook-lifecycle--entry-points)
3. [Delta Accounting System](#delta-accounting-system)
4. [Hook Implementation Patterns](#hook-implementation-patterns)
5. [Advanced Features](#advanced-features)
6. [Security Considerations](#security-considerations)
7. [Best Practices](#best-practices)

## Architecture Overview

### Singleton Design Pattern
Uniswap V4's revolutionary architecture centers around a **singleton PoolManager** contract that manages all pools, unlike V3 where each pool was a separate contract.

```solidity
// All pools managed by one contract
PoolManager.sol {
    - Manages all pool state
    - Handles all operations
    - Integrates with hooks
    - Tracks deltas in transient storage
}
```

### Hook Integration Architecture
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Router    │ --> │ PoolManager  │ --> │    Hook     │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                      │
                           └──────────────────────┘
                            (bidirectional calls)
```

## Hook Lifecycle & Entry Points

### Core Hook Functions (10)
Hooks can implement any combination of these lifecycle functions:

```solidity
// Pool Initialization
function beforeInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96) external returns (bytes4);
function afterInitialize(address sender, PoolKey calldata key, uint160 sqrtPriceX96, int24 tick) external returns (bytes4);

// Liquidity Management
function beforeAddLiquidity(address sender, PoolKey calldata key, IPoolManager.ModifyLiquidityParams calldata params, bytes calldata hookData) external returns (bytes4);
function afterAddLiquidity(address sender, PoolKey calldata key, IPoolManager.ModifyLiquidityParams calldata params, BalanceDelta delta, BalanceDelta feesAccrued, bytes calldata hookData) external returns (bytes4, BalanceDelta);

function beforeRemoveLiquidity(address sender, PoolKey calldata key, IPoolManager.ModifyLiquidityParams calldata params, bytes calldata hookData) external returns (bytes4);
function afterRemoveLiquidity(address sender, PoolKey calldata key, IPoolManager.ModifyLiquidityParams calldata params, BalanceDelta delta, BalanceDelta feesAccrued, bytes calldata hookData) external returns (bytes4, BalanceDelta);

// Swapping
function beforeSwap(address sender, PoolKey calldata key, IPoolManager.SwapParams calldata params, bytes calldata hookData) external returns (bytes4, BeforeSwapDelta, uint24);
function afterSwap(address sender, PoolKey calldata key, IPoolManager.SwapParams calldata params, BalanceDelta delta, bytes calldata hookData) external returns (bytes4, int128);

// Donations
function beforeDonate(address sender, PoolKey calldata key, uint256 amount0, uint256 amount1, bytes calldata hookData) external returns (bytes4);
function afterDonate(address sender, PoolKey calldata key, uint256 amount0, uint256 amount1, bytes calldata hookData) external returns (bytes4);
```

### Return Delta Flags (4)
These flags enable hooks to modify operation results:
- `beforeSwapReturnDelta`
- `afterSwapReturnDelta`
- `afterAddLiquidityReturnDelta`
- `afterRemoveLiquidityReturnDelta`

### Hook Permissions System
Hooks declare their capabilities through address encoding:

```solidity
function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
    return Hooks.Permissions({
        beforeInitialize: false,
        afterInitialize: false,
        beforeAddLiquidity: true,
        afterAddLiquidity: true,
        beforeRemoveLiquidity: false,
        afterRemoveLiquidity: false,
        beforeSwap: true,
        afterSwap: true,
        beforeDonate: false,
        afterDonate: false,
        beforeSwapReturnDelta: true,  // Can modify swap amounts
        afterSwapReturnDelta: false,
        afterAddLiquidityReturnDelta: false,
        afterRemoveLiquidityReturnDelta: false
    });
}
```

The last 14 bits of the hook's address encode which functions it implements, enabling gas-efficient permission checking.

## Delta Accounting System

### Core Concept
V4 tracks **changes** (deltas) rather than absolute balances, using transient storage (EIP-1153):

```solidity
// Instead of tracking balances:
balance[user] = 1000

// V4 tracks deltas:
delta[user] = +100  // User receives 100
delta[user] = -50   // User owes 50
// Net: User receives 50
```

### BeforeSwapDelta Mechanism
The most sophisticated delta type, enabling hooks to modify swap behavior:

```solidity
// BeforeSwapDelta structure (packed int256)
// Upper 128 bits: specified token delta
// Lower 128 bits: unspecified token delta

function toBeforeSwapDelta(int128 deltaSpecified, int128 deltaUnspecified) 
    returns (BeforeSwapDelta) {
    // Efficient bit packing
    return BeforeSwapDelta.wrap(
        (int256(deltaSpecified) << 128) | uint128(deltaUnspecified)
    );
}
```

### Delta Flow Example
```
1. User initiates swap: 100 USDC → USDT
2. Hook takes 1% fee in beforeSwap
3. Delta accounting:
   - Hook delta: -1 USDC (took fee)
   - BeforeSwapDelta returned: +1 USDC
   - Pool swaps: 99 USDC (100 - 1)
   - Final user delta: -100 USDC, +X USDT
```

## Hook Implementation Patterns

### 1. Basic Hook Structure
```solidity
contract MyHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using FixedPointMathLib for uint256;
    
    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}
    
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        // Define capabilities
    }
    
    // Implement hook functions
}
```

### 2. Hook Fee Implementation
```solidity
function _beforeSwap(
    address sender,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    bytes calldata hookData
) internal override returns (bytes4, BeforeSwapDelta, uint24) {
    // Calculate fee
    uint256 swapAmount = params.amountSpecified < 0 
        ? uint256(-params.amountSpecified) 
        : uint256(params.amountSpecified);
    uint256 feeAmount = (swapAmount * FEE_PERCENTAGE) / FEE_DENOMINATOR;
    
    // Determine fee currency
    Currency feeCurrency = params.zeroForOne 
        ? key.currency0 
        : key.currency1;
    
    // Take fee (creates debt for hook)
    poolManager.take(feeCurrency, address(this), feeAmount);
    
    // Return delta to transfer debt to swapper
    BeforeSwapDelta delta = toBeforeSwapDelta(
        int128(int256(feeAmount)), // Fee on specified token
        0                          // No change to unspecified
    );
    
    return (BaseHook.beforeSwap.selector, delta, 0);
}
```

### 3. Custom Curve Implementation
```solidity
function _beforeSwap(
    address,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    bytes calldata
) internal override returns (bytes4, BeforeSwapDelta, uint24) {
    // Implement custom pricing logic
    (int128 deltaIn, int128 deltaOut) = calculateCustomCurve(params);
    
    // Take input tokens
    poolManager.take(inputCurrency, address(this), uint256(deltaIn));
    
    // Give output tokens
    poolManager.give(outputCurrency, uint256(deltaOut));
    
    // Return deltas to bypass native pricing
    return (
        BaseHook.beforeSwap.selector,
        toBeforeSwapDelta(deltaIn, deltaOut),
        0
    );
}
```

### 4. Hook Data Pattern
```solidity
// Encoding user data
function getHookData(address user, uint256 minOutput) 
    public pure returns (bytes memory) {
    return abi.encode(user, minOutput);
}

// Decoding in hook
function parseHookData(bytes calldata data) 
    public pure returns (address user, uint256 minOutput) {
    return abi.decode(data, (address, uint256));
}
```

## Advanced Features

### 1. Custom Accounting
Hooks can completely override V4's native concentrated liquidity:

```solidity
// Constant-sum curve (x + y = k)
function constantSumSwap(uint256 amountIn) returns (uint256 amountOut) {
    // 1:1 exchange rate
    amountOut = amountIn;
    
    // Update hook's internal balances
    balance0 += amountIn;
    balance1 -= amountOut;
}
```

### 2. Async Swaps
Defer swap execution for MEV protection:

```solidity
mapping(bytes32 => PendingSwap) public pendingSwaps;

function _beforeSwap(...) internal override returns (...) {
    // Store swap for later execution
    pendingSwaps[swapId] = PendingSwap({
        user: sender,
        params: params,
        timestamp: block.timestamp
    });
    
    // Return max delta to prevent immediate execution
    return (selector, MAX_DELTA, 0);
}

function executeBatch(bytes32[] calldata swapIds) external {
    // Execute swaps in MEV-resistant order
}
```

### 3. Dynamic Fees
```solidity
function getFee(address, PoolKey calldata key) 
    external view returns (uint24) {
    // Calculate fee based on:
    // - Volatility
    // - Volume
    // - Time of day
    // - Pool utilization
    
    uint24 baseFee = 3000; // 0.3%
    uint24 volatilityMultiplier = getVolatility(key);
    
    return baseFee * volatilityMultiplier / 10000;
}
```

### 4. Just-In-Time (JIT) Liquidity
```solidity
function _beforeSwap(...) internal override returns (...) {
    // Detect large swap
    if (isLargeSwap(params)) {
        // Add liquidity just for this swap
        addJITLiquidity(key, params);
    }
}

function _afterSwap(...) internal override returns (...) {
    // Remove JIT liquidity
    if (hasJITLiquidity[key.toId()]) {
        removeJITLiquidity(key);
    }
}
```

## Security Considerations

### 1. Reentrancy Protection
```solidity
contract SecureHook is BaseHook {
    uint256 private locked = 1;
    
    modifier nonReentrant() {
        require(locked == 1, "Reentrant call");
        locked = 2;
        _;
        locked = 1;
    }
    
    function _beforeSwap(...) internal override nonReentrant returns (...) {
        // Protected logic
    }
}
```

### 2. Access Control
```solidity
mapping(address => bool) public authorized;

modifier onlyAuthorized() {
    require(authorized[msg.sender], "Unauthorized");
    _;
}
```

### 3. Validation Patterns
```solidity
function _beforeSwap(...) internal override returns (...) {
    // Validate pool
    require(isValidPool[key.toId()], "Invalid pool");
    
    // Validate amounts
    require(params.amountSpecified != 0, "Zero amount");
    
    // Validate slippage
    (address user, uint256 minOut) = parseHookData(hookData);
    require(outputAmount >= minOut, "Slippage");
}
```

### 4. MEV Protection
```solidity
// Time-based restrictions
require(block.timestamp >= lastSwap[user] + MIN_DELAY, "Too frequent");

// Commit-reveal pattern
mapping(bytes32 => uint256) private commitments;

function commitSwap(bytes32 commitment) external {
    commitments[commitment] = block.timestamp;
}

function revealSwap(SwapData calldata data, uint256 nonce) external {
    bytes32 commitment = keccak256(abi.encode(data, nonce));
    require(commitments[commitment] > 0, "Invalid commitment");
    require(block.timestamp >= commitments[commitment] + REVEAL_DELAY, "Too early");
    
    // Execute swap
}
```

## Best Practices

### 1. State Management
```solidity
// Use pool-specific state
mapping(PoolId => PoolState) public poolStates;

// Not global state that affects all pools
uint256 public globalCounter; // Avoid!
```

### 2. Gas Optimization
```solidity
// Pack structs efficiently
struct PoolState {
    uint128 volume24h;
    uint128 fees24h;
    uint64 lastUpdate;
    uint32 swapCount;
    uint32 uniqueUsers;
}
```

### 3. Event Emission Standards
```solidity
// Standard events for indexing
event HookSwap(
    bytes32 indexed poolId,
    address indexed sender,
    int128 amount0,
    int128 amount1,
    uint128 hookFeeAmount0,
    uint128 hookFeeAmount1
);

event HookFee(
    bytes32 indexed poolId,
    address indexed sender,
    uint128 feeAmount0,
    uint128 feeAmount1
);
```

### 4. Testing Patterns
```solidity
contract HookTest is Test {
    using EasyPosm for IPositionManager;
    
    function setUp() public {
        // Deploy fresh manager
        deployFreshManagerAndRouters();
        
        // Deploy hook to correct address
        address flags = address(
            uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG) ^ 
            (0x4444 << 144)
        );
        deployCodeTo("MyHook.sol:MyHook", abi.encode(manager), flags);
    }
}
```

### 5. Upgrade Patterns
```solidity
// Proxy pattern for upgradeable hooks
contract HookProxy {
    address public implementation;
    address public admin;
    
    function upgrade(address newImplementation) external {
        require(msg.sender == admin, "Not admin");
        implementation = newImplementation;
    }
    
    fallback() external payable {
        // Delegate to implementation
    }
}
```

## Common Patterns & Examples

### 1. Points/Rewards System
```solidity
mapping(address => uint256) public points;

function _afterSwap(...) internal override returns (...) {
    address user = parseUser(hookData);
    uint256 swapValue = calculateUSDValue(delta);
    
    // Award points based on volume
    points[user] += swapValue / POINTS_DIVISOR;
    
    // Emit event for tracking
    emit PointsAwarded(user, swapValue / POINTS_DIVISOR);
}
```

### 2. KYC/Compliance Hook
```solidity
mapping(address => bool) public kycApproved;

function _beforeSwap(...) internal override returns (...) {
    address user = parseUser(hookData);
    require(kycApproved[user], "KYC required");
    
    // Check sanctions list
    require(!sanctionsList[user], "Sanctioned address");
}
```

### 3. Time-Weighted Average Market Maker (TWAMM)
```solidity
struct Order {
    address owner;
    bool selling0For1;
    uint256 totalAmount;
    uint256 startTime;
    uint256 endTime;
}

mapping(bytes32 => Order[]) public activeOrders;

function _beforeSwap(...) internal override returns (...) {
    // Execute virtual orders up to current time
    executeVirtualOrders(key, block.timestamp);
    
    // Process regular swap
}
```

## Conclusion

Uniswap V4 hooks represent a paradigm shift in AMM design, transforming from rigid protocols to infinitely customizable platforms. The combination of:

- **Singleton architecture** for gas efficiency
- **Hook system** for extensibility  
- **Delta accounting** for flexible state management
- **Custom curves** for novel AMM designs

Creates unprecedented opportunities for DeFi innovation while maintaining the security and efficiency Uniswap is known for.

Key takeaways:
1. Hooks are external contracts that customize pool behavior
2. Delta accounting enables complex state transitions efficiently
3. BeforeSwapDelta is the key to implementing fees and custom logic
4. Security and gas optimization remain critical considerations
5. Standard patterns and events ensure ecosystem compatibility

The future of DeFi will be built on these customizable primitives, limited only by developer creativity.