// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./SimplePerpV2.sol";
import "./interfaces/IPyth.sol";

/**
 * @title SimplePerpWithPythUpdates
 * @dev Enhanced trading contract that updates Pyth prices on trade execution
 */
contract SimplePerpWithPythUpdates is SimplePerpV2 {
    IPyth public immutable pyth;
    
    constructor(
        address _usdc,
        address _ratioOracle,
        address _pyth
    ) SimplePerpV2(_usdc, _ratioOracle) {
        pyth = IPyth(_pyth);
    }
    
    /**
     * @dev Open position with fresh price update
     * @param priceUpdateData Fresh Pyth price data from API
     * @param baseToken Token to trade (e.g., "ETH")
     * @param quoteToken Quote token (e.g., "BTC")
     * @param notional Position size
     * @param isLong Long or short position
     */
    function openPositionWithPriceUpdate(
        bytes[] calldata priceUpdateData,
        string memory baseToken,
        string memory quoteToken,
        uint256 notional,
        bool isLong
    ) external payable {
        // Step 1: Update Pyth prices with fresh data
        uint256 updateFee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= updateFee, "Insufficient update fee");
        
        // Update Pyth contract with fresh prices
        pyth.updatePriceFeeds{value: updateFee}(priceUpdateData);
        
        // Step 2: Execute trade with fresh prices
        openPosition(baseToken, quoteToken, notional, isLong);
        
        // Step 3: Refund excess fee
        if (msg.value > updateFee) {
            payable(msg.sender).transfer(msg.value - updateFee);
        }
        
        emit TradeExecutedWithPriceUpdate(
            msg.sender,
            baseToken,
            quoteToken,
            notional,
            isLong,
            block.timestamp
        );
    }
    
    /**
     * @dev Close position with fresh price update
     */
    function closePositionWithPriceUpdate(
        bytes[] calldata priceUpdateData,
        uint256 positionId
    ) external payable {
        // Update prices first
        uint256 updateFee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= updateFee, "Insufficient update fee");
        
        pyth.updatePriceFeeds{value: updateFee}(priceUpdateData);
        
        // Close position with fresh prices
        closePosition(positionId);
        
        // Refund excess
        if (msg.value > updateFee) {
            payable(msg.sender).transfer(msg.value - updateFee);
        }
    }
    
    /**
     * @dev Get update fee for price data
     */
    function getUpdateFee(bytes[] calldata priceUpdateData) 
        external view returns (uint256) {
        return pyth.getUpdateFee(priceUpdateData);
    }
    
    event TradeExecutedWithPriceUpdate(
        address indexed trader,
        string baseToken,
        string quoteToken,
        uint256 notional,
        bool isLong,
        uint256 timestamp
    );
}