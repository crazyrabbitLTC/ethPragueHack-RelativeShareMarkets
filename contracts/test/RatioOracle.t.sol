// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/RatioOracle.sol";

contract RatioOracleTest is Test {
    RatioOracle public oracle;
    
    function setUp() public {
        oracle = new RatioOracle();
    }
    
    function test_GetRatioShare_ReturnsCorrectShare() public {
        oracle.setPrice("ETH", 3000e8);
        oracle.setPrice("BTC", 60000e8);
        
        uint256 ethShare = oracle.getRatioShare("ETH", "BTC");
        
        assertEq(ethShare, 47619047619047619);
    }
    
    function test_GetRatioShare_ReturnsFullShareForSingleToken() public {
        oracle.setPrice("ETH", 3000e8);
        oracle.setPrice("BTC", 0);
        
        uint256 ethShare = oracle.getRatioShare("ETH", "BTC");
        
        assertEq(ethShare, 1e18);
    }
    
    function test_GetRatioShare_RevertsOnZeroTotalValue() public {
        oracle.setPrice("ETH", 0);
        oracle.setPrice("BTC", 0);
        
        vm.expectRevert("Total value cannot be zero");
        oracle.getRatioShare("ETH", "BTC");
    }
}