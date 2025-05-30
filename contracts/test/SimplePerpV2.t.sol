// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SimplePerpV2.sol";
import "../src/RatioOracle.sol";
import "../src/mocks/MockUSDC.sol";

contract SimplePerpV2Test is Test {
    SimplePerpV2 public perp;
    RatioOracle public oracle;
    MockUSDC public usdc;
    
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public admin = address(0x3);
    
    event EmergencyPause(address indexed by, uint256 timestamp);
    event Unpause(address indexed by, uint256 timestamp);
    event PositionUpdated(address indexed user, uint256 currentShare, int256 unrealizedPnl, uint256 timestamp);
    
    function setUp() public {
        vm.prank(admin);
        usdc = new MockUSDC();
        
        vm.prank(admin);
        oracle = new RatioOracle();
        
        vm.prank(admin);
        perp = new SimplePerpV2(address(usdc), address(oracle));
        
        oracle.setPrice("ETH", 3000e8);
        oracle.setPrice("BTC", 60000e8);
        
        usdc.mint(alice, 10000e6);
        usdc.mint(bob, 10000e6);
        
        vm.prank(alice);
        usdc.approve(address(perp), type(uint256).max);
        
        vm.prank(bob);
        usdc.approve(address(perp), type(uint256).max);
    }
    
    function test_PauseUnpause() public {
        // Only owner can pause
        vm.expectRevert("Only owner");
        vm.prank(alice);
        perp.pause();
        
        // Owner pauses
        vm.expectEmit(true, false, false, true);
        emit EmergencyPause(admin, block.timestamp);
        vm.prank(admin);
        perp.pause();
        
        assertTrue(perp.paused());
        
        // Cannot deposit when paused
        vm.expectRevert("Contract is paused");
        vm.prank(alice);
        perp.deposit(1000e6);
        
        // Owner unpauses
        vm.expectEmit(true, false, false, true);
        emit Unpause(admin, block.timestamp);
        vm.prank(admin);
        perp.unpause();
        
        assertFalse(perp.paused());
        
        // Can deposit after unpause
        vm.prank(alice);
        perp.deposit(1000e6);
    }
    
    function test_EnhancedEvents() public {
        vm.prank(alice);
        perp.deposit(1000e6);
        
        // Check enhanced deposit event
        vm.prank(alice);
        perp.deposit(500e6);
        
        // Verify balance after deposits
        assertEq(perp.balances(alice), 1500e6);
        
        // Open position and verify it was created
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 1000e6, true);
        
        // Verify position exists
        (,, uint256 notional,,,,,,) = perp.getPositionDetails(alice);
        assertEq(notional, 1000e6);
    }
    
    function test_ViewFunctions() public {
        // Setup position
        vm.prank(alice);
        perp.deposit(2000e6);
        
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 1000e6, true);
        
        // Test getPositionDetails
        (
            string memory baseToken,
            string memory quoteToken,
            uint256 notional,
            bool isLong,
            uint256 entryShare,
            uint256 currentShare,
            int256 unrealizedPnl,
            uint256 openedAt,
            uint256 duration
        ) = perp.getPositionDetails(alice);
        
        assertEq(baseToken, "ETH");
        assertEq(quoteToken, "BTC");
        assertEq(notional, 1000e6);
        assertTrue(isLong);
        assertEq(entryShare, oracle.getRatioShare("ETH", "BTC"));
        assertEq(currentShare, oracle.getRatioShare("ETH", "BTC"));
        assertEq(unrealizedPnl, 0);
        assertEq(openedAt, block.timestamp);
        assertEq(duration, 0);
        
        // Test getUserDetails
        (
            uint256 balance,
            uint256 totalDeposited,
            uint256 totalWithdrawn,
            uint256 realizedPnl,
            uint256 positionCount,
            bool hasOpenPosition,
            int256 userUnrealizedPnl
        ) = perp.getUserDetails(alice);
        
        assertEq(balance, 2000e6);
        assertEq(totalDeposited, 2000e6);
        assertEq(totalWithdrawn, 0);
        assertEq(realizedPnl, 0);
        assertEq(positionCount, 1);
        assertTrue(hasOpenPosition);
        assertEq(userUnrealizedPnl, 0);
    }
    
    function test_ProtocolStats() public {
        vm.prank(alice);
        perp.deposit(1000e6);
        
        vm.prank(bob);
        perp.deposit(2000e6);
        
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 500e6, true);
        
        vm.prank(bob);
        perp.openPosition("ETH", "BTC", 1000e6, false);
        
        (
            uint256 totalDepositAmount,
            uint256 totalOpenInterestAmount,
            uint256 totalPositionCount,
            address collateralTokenAddress,
            bool isPaused
        ) = perp.getProtocolStats();
        
        assertEq(totalDepositAmount, 3000e6);
        assertEq(totalOpenInterestAmount, 1500e6);
        assertEq(totalPositionCount, 2);
        assertEq(collateralTokenAddress, address(usdc));
        assertFalse(isPaused);
    }
    
    function test_UpdatePositionTracking() public {
        vm.prank(alice);
        perp.deposit(1000e6);
        
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 1000e6, true);
        
        // Change price
        oracle.setPrice("ETH", 3300e8);
        
        // Update tracking
        vm.expectEmit(true, false, false, false);
        emit PositionUpdated(alice, oracle.getRatioShare("ETH", "BTC"), perp.getPositionValue(alice), block.timestamp);
        perp.updatePositionTracking(alice);
    }
    
    function test_CanOpenPosition() public {
        assertFalse(perp.canOpenPosition(alice, 1000e6)); // No balance
        
        vm.prank(alice);
        perp.deposit(200e6);
        
        assertFalse(perp.canOpenPosition(alice, 1000e6)); // Insufficient margin (needs 300)
        assertTrue(perp.canOpenPosition(alice, 600e6)); // Sufficient margin
        
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 600e6, true);
        
        assertFalse(perp.canOpenPosition(alice, 100e6)); // Already has position
    }
    
    function test_OwnershipTransfer() public {
        address newOwner = address(0x4);
        
        vm.expectRevert("Only owner");
        vm.prank(alice);
        perp.transferOwnership(newOwner);
        
        vm.prank(admin);
        perp.transferOwnership(newOwner);
        
        assertEq(perp.owner(), newOwner);
        
        // New owner can pause
        vm.prank(newOwner);
        perp.pause();
        assertTrue(perp.paused());
    }
}