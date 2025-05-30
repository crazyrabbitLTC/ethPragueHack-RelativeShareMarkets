// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SimplePerp.sol";
import "../src/RatioOracle.sol";
import "../src/mocks/MockUSDC.sol";

contract SimplePerpTest is Test {
    SimplePerp public perp;
    RatioOracle public oracle;
    MockUSDC public usdc;
    
    address public alice = address(0x1);
    address public bob = address(0x2);
    
    function setUp() public {
        usdc = new MockUSDC();
        oracle = new RatioOracle();
        perp = new SimplePerp(address(usdc), address(oracle));
        
        oracle.setPrice("ETH", 3000e8);
        oracle.setPrice("BTC", 60000e8);
        
        usdc.mint(alice, 10000e6);
        usdc.mint(bob, 10000e6);
        
        vm.prank(alice);
        usdc.approve(address(perp), type(uint256).max);
        
        vm.prank(bob);
        usdc.approve(address(perp), type(uint256).max);
    }
    
    function test_Deposit() public {
        vm.prank(alice);
        perp.deposit(1000e6);
        
        assertEq(perp.balances(alice), 1000e6);
        assertEq(usdc.balanceOf(alice), 9000e6);
        assertEq(usdc.balanceOf(address(perp)), 1000e6);
    }
    
    function test_Withdraw() public {
        vm.prank(alice);
        perp.deposit(1000e6);
        
        vm.prank(alice);
        perp.withdraw(500e6);
        
        assertEq(perp.balances(alice), 500e6);
        assertEq(usdc.balanceOf(alice), 9500e6);
    }
    
    function test_OpenPosition() public {
        vm.prank(alice);
        perp.deposit(1000e6);
        
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 1000e6, true);
        
        (string memory baseToken, string memory quoteToken, uint256 notional, bool isLong, uint256 entryShare) = perp.positions(alice);
        
        assertEq(baseToken, "ETH");
        assertEq(quoteToken, "BTC");
        assertEq(notional, 1000e6);
        assertEq(isLong, true);
        assertEq(entryShare, oracle.getRatioShare("ETH", "BTC"));
    }
    
    function test_OpenPosition_RevertsInsufficientMargin() public {
        vm.prank(alice);
        perp.deposit(100e6);
        
        vm.expectRevert("Insufficient margin");
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 1000e6, true);
    }
    
    function test_ClosePosition() public {
        vm.prank(alice);
        perp.deposit(1000e6);
        
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 1000e6, true);
        
        oracle.setPrice("ETH", 3300e8);
        
        uint256 balanceBefore = perp.balances(alice);
        
        vm.prank(alice);
        perp.closePosition();
        
        uint256 balanceAfter = perp.balances(alice);
        
        assertTrue(balanceAfter > balanceBefore);
    }
}