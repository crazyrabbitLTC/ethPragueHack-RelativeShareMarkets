// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IPyth.sol";

contract RatioOracle {
    IPyth public pyth;
    address public owner;
    
    mapping(string => uint256) public mockPrices;
    mapping(string => bytes32) public priceIds;
    
    bool public useMockPrices = true;
    uint256 public constant MAX_PRICE_AGE = 5 minutes;
    
    event PricesUpdated(uint256 timestamp);
    event PythOracleSet(address pyth);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        // Arbitrum mainnet price IDs
        priceIds["ETH"] = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
        priceIds["BTC"] = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
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
    
    function setPriceId(string memory token, bytes32 priceId) external {
        priceIds[token] = priceId;
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
        // Pyth ETH/USD and BTC/USD always have expo = -8
        // So price is in 1e8, we need 1e18
        uint256 price = uint256(uint64(pythPrice.price));
        
        // Since we know expo is -8 for ETH/BTC, just multiply by 1e10
        return price * 1e10; // 1e8 * 1e10 = 1e18
    }
    
    function getRatioShare(string memory baseToken, string memory quoteToken) external view returns (uint256) {
        uint256 basePrice = getPrice(baseToken);
        uint256 quotePrice = getPrice(quoteToken);
        
        uint256 totalValue = basePrice + quotePrice;
        
        require(totalValue > 0, "Total value cannot be zero");
        
        // Return share as 1e18 scaled value
        return (basePrice * 1e18) / totalValue;
    }
    
    function getUpdateFee(bytes[] calldata priceUpdateData) external view returns (uint256) {
        require(address(pyth) != address(0), "Pyth oracle not set");
        return pyth.getUpdateFee(priceUpdateData);
    }
    
    // Keeper helper to push both ETH and BTC prices in one transaction
    function pushPyth(bytes[] calldata priceUpdateData) external payable {
        require(address(pyth) != address(0), "Pyth oracle not set");
        require(priceUpdateData.length == 2, "Must provide exactly 2 price updates");
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