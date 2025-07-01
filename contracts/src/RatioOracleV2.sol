// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IPyth.sol";

/**
 * @title RatioOracleV2
 * @notice Enhanced oracle with circuit breakers, price deviation checks, and historical data
 * @dev Production-ready oracle for RMSP protocol
 */
contract RatioOracleV2 {
    // ========== CONSTANTS ==========
    uint256 public constant PRECISION = 1e18;
    uint256 public constant MAX_PRICE_AGE = 60; // 60 seconds
    uint256 public constant MAX_PRICE_DEVIATION = 500; // 5% in bps
    uint256 public constant PRICE_DECIMALS = 8; // Pyth uses 8 decimals
    
    // ========== STATE VARIABLES ==========
    IPyth public immutable pyth;
    address public owner;
    address public keeper;
    
    // Price feeds
    mapping(string => bytes32) public priceIds;
    mapping(string => uint256) public lastValidPrice;
    mapping(string => uint256) public lastUpdateTime;
    
    // Historical data for entry price tracking
    mapping(bytes32 => mapping(uint256 => uint256)) public historicalPrices; // priceId => timestamp => price
    
    // Circuit breaker
    bool public circuitBreakerActive;
    uint256 public circuitBreakerThreshold = 1000; // 10% max change
    
    // ========== EVENTS ==========
    event PriceUpdated(string token, uint256 price, uint256 timestamp);
    event CircuitBreakerTriggered(string token, uint256 oldPrice, uint256 newPrice);
    event PriceIdSet(string token, bytes32 priceId);
    event KeeperUpdated(address newKeeper);
    
    // ========== MODIFIERS ==========
    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized");
        _;
    }
    
    modifier onlyKeeper() {
        require(msg.sender == keeper || msg.sender == owner, "Not keeper");
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    constructor(address _pyth) {
        require(_pyth != address(0), "Invalid Pyth");
        pyth = IPyth(_pyth);
        owner = msg.sender;
        keeper = msg.sender;
        
        // Initialize Arbitrum mainnet price IDs
        priceIds["ETH"] = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
        priceIds["BTC"] = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    }
    
    // ========== PRICE FUNCTIONS ==========
    
    /**
     * @notice Update price feeds with Pyth data
     * @param priceUpdateData Pyth price update data
     */
    function updatePriceFeeds(bytes[] calldata priceUpdateData) external payable {
        uint fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        
        // Validate and store prices
        _validateAndStorePrice("ETH");
        _validateAndStorePrice("BTC");
        
        // Refund excess
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }
    
    /**
     * @notice Get current price for a token
     * @param token Token symbol
     * @return price Price in 18 decimals
     */
    function getPrice(string memory token) public view returns (uint256) {
        bytes32 priceId = priceIds[token];
        require(priceId != bytes32(0), "Price ID not set");
        
        // Check circuit breaker
        require(!circuitBreakerActive, "Circuit breaker active");
        
        try pyth.getPrice(priceId) returns (IPyth.Price memory pythPrice) {
            require(pythPrice.price > 0, "Invalid price");
            require(block.timestamp - pythPrice.publishTime <= MAX_PRICE_AGE, "Price stale");
            
            // Convert to 18 decimals
            uint256 price = uint256(uint64(pythPrice.price)) * 10**(18 - PRICE_DECIMALS);
            
            // Check deviation from last valid price
            uint256 lastPrice = lastValidPrice[token];
            if (lastPrice > 0) {
                uint256 deviation = price > lastPrice ? 
                    ((price - lastPrice) * 10000) / lastPrice :
                    ((lastPrice - price) * 10000) / lastPrice;
                    
                require(deviation <= MAX_PRICE_DEVIATION, "Price deviation too high");
            }
            
            return price;
        } catch {
            // Fallback to last valid price if within tolerance
            uint256 lastPrice = lastValidPrice[token];
            require(lastPrice > 0, "No valid price");
            require(block.timestamp - lastUpdateTime[token] <= MAX_PRICE_AGE * 2, "Last price too old");
            return lastPrice;
        }
    }
    
    /**
     * @notice Get ratio share between two tokens
     * @param baseToken Base token symbol
     * @param quoteToken Quote token symbol
     * @return share Ratio in 18 decimals (baseToken / (baseToken + quoteToken))
     */
    function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256) {
        uint256 basePrice = getPrice(baseToken);
        uint256 quotePrice = getPrice(quoteToken);
        
        uint256 totalValue = basePrice + quotePrice;
        require(totalValue > 0, "Zero total value");
        
        return (basePrice * PRECISION) / totalValue;
    }
    
    /**
     * @notice Get historical ratio for position entry tracking
     * @param baseToken Base token symbol
     * @param quoteToken Quote token symbol
     * @param timestamp Historical timestamp
     * @return ratio Historical ratio
     */
    function getHistoricalRatio(
        string memory baseToken,
        string memory quoteToken,
        uint256 timestamp
    ) external view returns (uint256) {
        bytes32 basePriceId = priceIds[baseToken];
        bytes32 quotePriceId = priceIds[quoteToken];
        
        uint256 basePrice = historicalPrices[basePriceId][timestamp];
        uint256 quotePrice = historicalPrices[quotePriceId][timestamp];
        
        // Fallback to current if no historical data
        if (basePrice == 0) basePrice = getPrice(baseToken);
        if (quotePrice == 0) quotePrice = getPrice(quoteToken);
        
        uint256 totalValue = basePrice + quotePrice;
        require(totalValue > 0, "Zero total value");
        
        return (basePrice * PRECISION) / totalValue;
    }
    
    // ========== INTERNAL FUNCTIONS ==========
    
    /**
     * @notice Validate and store price with circuit breaker checks
     * @param token Token symbol
     */
    function _validateAndStorePrice(string memory token) internal {
        bytes32 priceId = priceIds[token];
        if (priceId == bytes32(0)) return;
        
        try pyth.getPrice(priceId) returns (IPyth.Price memory pythPrice) {
            if (pythPrice.price <= 0) return;
            
            uint256 newPrice = uint256(uint64(pythPrice.price)) * 10**(18 - PRICE_DECIMALS);
            uint256 oldPrice = lastValidPrice[token];
            
            // Circuit breaker check
            if (oldPrice > 0) {
                uint256 change = newPrice > oldPrice ?
                    ((newPrice - oldPrice) * 10000) / oldPrice :
                    ((oldPrice - newPrice) * 10000) / oldPrice;
                    
                if (change > circuitBreakerThreshold) {
                    circuitBreakerActive = true;
                    emit CircuitBreakerTriggered(token, oldPrice, newPrice);
                    return;
                }
            }
            
            // Store price
            lastValidPrice[token] = newPrice;
            lastUpdateTime[token] = block.timestamp;
            historicalPrices[priceId][block.timestamp] = newPrice;
            
            emit PriceUpdated(token, newPrice, block.timestamp);
        } catch {
            // Ignore failures in internal validation
        }
    }
    
    // ========== ADMIN FUNCTIONS ==========
    
    /**
     * @notice Set price ID for a token
     * @param token Token symbol
     * @param priceId Pyth price feed ID
     */
    function setPriceId(string memory token, bytes32 priceId) external onlyOwner {
        require(priceId != bytes32(0), "Invalid price ID");
        priceIds[token] = priceId;
        emit PriceIdSet(token, priceId);
    }
    
    /**
     * @notice Reset circuit breaker
     */
    function resetCircuitBreaker() external onlyOwner {
        circuitBreakerActive = false;
    }
    
    /**
     * @notice Update circuit breaker threshold
     * @param threshold New threshold in bps
     */
    function setCircuitBreakerThreshold(uint256 threshold) external onlyOwner {
        require(threshold >= 100 && threshold <= 5000, "Invalid threshold");
        circuitBreakerThreshold = threshold;
    }
    
    /**
     * @notice Update keeper address
     * @param newKeeper New keeper address
     */
    function setKeeper(address newKeeper) external onlyOwner {
        require(newKeeper != address(0), "Invalid keeper");
        keeper = newKeeper;
        emit KeeperUpdated(newKeeper);
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
    
    // ========== KEEPER FUNCTIONS ==========
    
    /**
     * @notice Push price updates (keeper only)
     * @param priceUpdateData Pyth price update data
     */
    function pushPriceUpdate(bytes[] calldata priceUpdateData) external payable onlyKeeper {
        updatePriceFeeds(priceUpdateData);
    }
    
    /**
     * @notice Manual price update for emergencies
     * @param token Token symbol
     * @param price Manual price (18 decimals)
     */
    function setManualPrice(string memory token, uint256 price) external onlyOwner {
        require(circuitBreakerActive, "Only during circuit breaker");
        require(price > 0, "Invalid price");
        
        lastValidPrice[token] = price;
        lastUpdateTime[token] = block.timestamp;
        
        emit PriceUpdated(token, price, block.timestamp);
    }
}