// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IPyth.sol";

/**
 * @title PythPriceTracker
 * @dev Enhanced oracle that tracks Pyth price updates for indexing
 */
contract PythPriceTracker {
    IPyth public pyth;
    address public owner;
    
    mapping(string => bytes32) public priceIds;
    uint256 public constant MAX_PRICE_AGE = 5 minutes;
    
    // Events for indexer to track
    event PythPriceUpdated(
        string indexed token,
        bytes32 indexed priceId,
        int64 price,
        uint64 confidence,
        uint64 publishTime,
        uint256 blockTimestamp,
        address updater
    );
    
    event RatioCalculated(
        string indexed baseToken,
        string indexed quoteToken,
        uint256 basePrice,
        uint256 quotePrice,
        uint256 ratio,
        uint256 blockTimestamp
    );
    
    event PriceStaleWarning(
        string indexed token,
        bytes32 indexed priceId,
        uint64 lastPublishTime,
        uint256 staleness
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor(address _pyth) {
        owner = msg.sender;
        pyth = IPyth(_pyth);
        
        // Set price IDs for ETH and BTC
        priceIds["ETH"] = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
        priceIds["BTC"] = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    }
    
    function updatePriceFeeds(bytes[] calldata priceUpdateData) external payable {
        uint fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        
        // Update prices on Pyth contract
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        
        // Emit events for each token we care about
        _emitPriceUpdateEvents();
        
        // Refund excess fee
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }
    
    function _emitPriceUpdateEvents() internal {
        // Emit price update events for indexer
        _emitTokenPriceUpdate("ETH");
        _emitTokenPriceUpdate("BTC");
        
        // Calculate and emit ratio
        _emitRatioUpdate("ETH", "BTC");
    }
    
    function _emitTokenPriceUpdate(string memory token) internal {
        bytes32 priceId = priceIds[token];
        if (priceId == bytes32(0)) return;
        
        try pyth.getPriceUnsafe(priceId) returns (IPyth.Price memory price) {
            emit PythPriceUpdated(
                token,
                priceId,
                price.price,
                price.conf,
                price.publishTime,
                block.timestamp,
                msg.sender
            );
            
            // Check for staleness
            uint256 staleness = block.timestamp - price.publishTime;
            if (staleness > MAX_PRICE_AGE) {
                emit PriceStaleWarning(token, priceId, price.publishTime, staleness);
            }
            
        } catch {
            // Price not available
        }
    }
    
    function _emitRatioUpdate(string memory baseToken, string memory quoteToken) internal {
        try this.getPrice(baseToken) returns (uint256 basePrice) {
            try this.getPrice(quoteToken) returns (uint256 quotePrice) {
                uint256 totalValue = basePrice + quotePrice;
                if (totalValue > 0) {
                    uint256 ratio = (basePrice * 1e18) / totalValue;
                    
                    emit RatioCalculated(
                        baseToken,
                        quoteToken,
                        basePrice,
                        quotePrice,
                        ratio,
                        block.timestamp
                    );
                }
            } catch {}
        } catch {}
    }
    
    function getPrice(string memory token) external view returns (uint256) {
        bytes32 priceId = priceIds[token];
        require(priceId != bytes32(0), "Price ID not set");
        
        IPyth.Price memory pythPrice = pyth.getPriceUnsafe(priceId);
        require(pythPrice.price > 0, "Invalid price");
        require(block.timestamp - pythPrice.publishTime <= MAX_PRICE_AGE, "Price too stale");
        
        // Convert to 1e18 format
        uint256 price = uint256(uint64(pythPrice.price));
        return price * 1e10; // Assuming -8 exponent
    }
    
    function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256) {
        uint256 basePrice = this.getPrice(baseToken);
        uint256 quotePrice = this.getPrice(quoteToken);
        uint256 totalValue = basePrice + quotePrice;
        require(totalValue > 0, "Total value cannot be zero");
        return (basePrice * 1e18) / totalValue;
    }
    
    // Manual price check function for demo
    function checkCurrentPrices() external {
        _emitPriceUpdateEvents();
    }
    
    function setPriceId(string memory token, bytes32 priceId) external onlyOwner {
        priceIds[token] = priceId;
    }
}