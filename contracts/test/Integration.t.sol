// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SimplePerp.sol";
import "../src/RatioOracle.sol";
import "../src/mocks/MockUSDC.sol";

contract IntegrationTest is Test {
    SimplePerp public perp;
    RatioOracle public oracle;
    MockUSDC public usdc;
    
    address public alice = address(0x1);
    address public bob = address(0x2);
    
    function setUp() public {
        usdc = new MockUSDC();
        oracle = new RatioOracle();
        perp = new SimplePerp(address(usdc), address(oracle));
        
        // Initial prices: ETH = $3000, BTC = $60000
        oracle.setPrice("ETH", 3000e18);
        oracle.setPrice("BTC", 60000e18);
        
        // Fund users
        usdc.mint(alice, 10000e6);
        usdc.mint(bob, 10000e6);
        
        // Approve perp contract
        vm.prank(alice);
        usdc.approve(address(perp), type(uint256).max);
        
        vm.prank(bob);
        usdc.approve(address(perp), type(uint256).max);
    }
    
    function test_PnLSymmetry() public {
        // Both users deposit $1000
        vm.prank(alice);
        perp.deposit(1000e6);
        
        vm.prank(bob);
        perp.deposit(1000e6);
        
        // Alice goes long ETH/BTC with $1000 notional
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 1000e6, true);
        
        // Bob goes short ETH/BTC with $1000 notional
        vm.prank(bob);
        perp.openPosition("ETH", "BTC", 1000e6, false);
        
        // Record initial balances
        uint256 aliceInitial = perp.balances(alice);
        uint256 bobInitial = perp.balances(bob);
        uint256 totalInitial = aliceInitial + bobInitial;
        
        // ETH price increases 10% relative to BTC
        // New prices: ETH = $3300, BTC = $60000
        oracle.setPrice("ETH", 3300e18);
        
        // Both close positions
        vm.prank(alice);
        perp.closePosition();
        
        vm.prank(bob);
        perp.closePosition();
        
        // Check final balances
        uint256 aliceFinal = perp.balances(alice);
        uint256 bobFinal = perp.balances(bob);
        uint256 totalFinal = aliceFinal + bobFinal;
        
        // Alice should have gained
        assertTrue(aliceFinal > aliceInitial, "Alice should have profit");
        
        // Bob should have lost
        assertTrue(bobFinal < bobInitial, "Bob should have loss");
        
        // Total should be conserved (zero-sum game)
        assertEq(totalFinal, totalInitial, "Total balance should be conserved");
        
        // PnL should be equal and opposite
        int256 alicePnL = int256(aliceFinal) - int256(aliceInitial);
        int256 bobPnL = int256(bobFinal) - int256(bobInitial);
        
        assertEq(alicePnL, -bobPnL, "PnL should be symmetric");
    }
    
    function test_PnLCalculation() public {
        // Setup position
        vm.prank(alice);
        perp.deposit(1000e6);
        
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 1000e6, true);
        
        // Initial share: ETH 3000 / (ETH 3000 + BTC 60000) = 3000/63000 = 0.047619...
        uint256 initialShare = oracle.getRatioShare("ETH", "BTC");
        assertEq(initialShare, 47619047619047619); // ~4.76%
        
        // Price change: ETH to $3300
        oracle.setPrice("ETH", 3300e18);
        
        // New share: ETH 3300 / (ETH 3300 + BTC 60000) = 3300/63300 = 0.052133...
        uint256 newShare = oracle.getRatioShare("ETH", "BTC");
        // Allow for small rounding differences
        assertTrue(newShare > 52e15 && newShare < 53e15, "New share should be ~5.2%");
        
        // Expected PnL calculation:
        // Share change = 5.21% - 4.76% = 0.45%
        // PnL = $1000 * 0.45% = $4.50 (approximately)
        
        vm.prank(alice);
        perp.closePosition();
        
        // Alice should have roughly $1004.50
        uint256 aliceFinal = perp.balances(alice);
        assertTrue(aliceFinal > 1004e6 && aliceFinal < 1005e6, "PnL should be around $4.50");
    }
}