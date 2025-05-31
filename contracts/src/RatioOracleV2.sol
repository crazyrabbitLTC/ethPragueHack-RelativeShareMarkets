// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IPyth.sol";

contract RatioOracleV2 {
    IPyth public pyth;
    address public owner;
    
    mapping(string => uint256) public mockPrices;
    mapping(string => bytes32) public priceIds;
    
    bool public useMockPrices = true;
    uint256 public constant MAX_PRICE_AGE = 5 minutes;
    
    event PricesUpdated(uint256 timestamp);
    event PythOracleSet(address pyth);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PriceIdSet(string token, bytes32 priceId);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        // Arbitrum mainnet price IDs
        priceIds["ETH"] = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
        priceIds["BTC"] = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
        
        // Add new price feed IDs - these need to be verified from Pyth docs
        // SOL/USD - example ID (needs verification)
        priceIds["SOL"] = 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d;
        // ARB/USD - example ID (needs verification)  
        priceIds["ARB"] = 0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5;
        // AVAX/USD - example ID (needs verification)
        priceIds["AVAX"] = 0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7;
    }
    
    function setPythOracle(address _pyth) external onlyOwner {
        pyth = IPyth(_pyth);
        useMockPrices = false;
        emit PythOracleSet(_pyth);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
    
    function setPrice(string memory token, uint256 price) external {
        mockPrices[token] = price;
    }
    
    function setPriceId(string memory token, bytes32 priceId) external onlyOwner {
        priceIds[token] = priceId;
        emit PriceIdSet(token, priceId);
    }
    
    function updatePriceFeeds(bytes[] calldata priceUpdateData) external payable {
        require(address(pyth) != address(0), "Pyth oracle not set");
        
        uint fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        
        emit PricesUpdated(block.timestamp);
        
        // Refund excess fee
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }
    
    function getPrice(string memory token) public view returns (uint256) {
        if (useMockPrices) {
            return mockPrices[token];
        }
        
        bytes32 priceId = priceIds[token];
        require(priceId != bytes32(0), "Price ID not set");
        
        IPyth.Price memory pythPrice = pyth.getPriceUnsafe(priceId);
        
        // Check price validity
        require(pythPrice.price > 0, "Invalid price");
        
        // Check staleness
        require(block.timestamp - pythPrice.publishTime <= MAX_PRICE_AGE, "Price too stale");
        
        // Convert price with simplified exponent handling
        // Pyth prices typically have expo = -8
        uint256 price = uint256(uint64(pythPrice.price));
        
        // Assuming expo is -8 for all crypto prices
        return price * 1e10; // 1e8 * 1e10 = 1e18
    }
    
    // Legacy function for backward compatibility
    function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256) {
        uint256 basePrice = getPrice(baseToken);
        uint256 quotePrice = getPrice(quoteToken);
        
        uint256 totalValue = basePrice + quotePrice;
        
        require(totalValue > 0, "Total value cannot be zero");
        
        // Return share as 1e18 scaled value
        return (basePrice * 1e18) / totalValue;
    }
    
    // NEW: Multi-token relative share calculation
    function getMultiTokenShares(string[] memory tokens) external view returns (uint256[] memory shares) {
        uint256 tokensLength = tokens.length;
        require(tokensLength > 0, "No tokens provided");
        require(tokensLength <= 8, "Too many tokens");
        
        uint256[] memory prices = new uint256[](tokensLength);
        uint256 totalValue = 0;
        
        // Get all prices and calculate total value
        for (uint256 i = 0; i < tokensLength; i++) {
            prices[i] = getPrice(tokens[i]);
            totalValue += prices[i];
        }
        
        require(totalValue > 0, "Total value cannot be zero");
        
        // Calculate relative shares
        shares = new uint256[](tokensLength);
        for (uint256 i = 0; i < tokensLength; i++) {
            shares[i] = (prices[i] * 1e18) / totalValue;
        }
        
        return shares;
    }
    
    // Get multiple prices in one call
    function getMultiplePrices(string[] memory tokens) external view returns (uint256[] memory prices) {
        prices = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            prices[i] = getPrice(tokens[i]);
        }
        return prices;
    }
    
    function getUpdateFee(bytes[] calldata priceUpdateData) external view returns (uint256) {
        require(address(pyth) != address(0), "Pyth oracle not set");
        return pyth.getUpdateFee(priceUpdateData);
    }
    
    // Enhanced keeper helper to push multiple prices
    function pushPyth(bytes[] calldata priceUpdateData) external payable {
        require(address(pyth) != address(0), "Pyth oracle not set");
        require(!useMockPrices, "Cannot push prices in mock mode");
        
        uint fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        
        emit PricesUpdated(block.timestamp);
        
        // Refund excess fee
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }
}