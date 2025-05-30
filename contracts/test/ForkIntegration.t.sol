// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SimplePerpV2.sol";
import "../src/RatioOracle.sol";
import "../src/mocks/MockUSDC.sol";

contract ForkIntegrationTest is Test {
    SimplePerpV2 public perp;
    RatioOracle public oracle;
    MockUSDC public usdc;
    
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public keeper = address(0x3);
    
    // Arbitrum mainnet addresses
    address constant PYTH_ORACLE = 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C;
    
    function setUp() public {
        // Fork Arbitrum mainnet
        string memory rpcUrl = vm.envString("ARBITRUM_RPC_URL");
        vm.createSelectFork(rpcUrl);
        
        // Deploy contracts
        usdc = new MockUSDC();
        oracle = new RatioOracle();
        perp = new SimplePerpV2(address(usdc), address(oracle));
        
        // Mint USDC to users
        usdc.mint(alice, 10000e6);
        usdc.mint(bob, 10000e6);
        usdc.mint(keeper, 1 ether); // For gas
        
        // Approve perp
        vm.prank(alice);
        usdc.approve(address(perp), type(uint256).max);
        
        vm.prank(bob);
        usdc.approve(address(perp), type(uint256).max);
    }
    
    function test_ForkPnLSymmetry() public {
        // Start with mock prices
        oracle.setPrice("ETH", 3000e18);
        oracle.setPrice("BTC", 60000e18);
        
        // Both users deposit
        vm.prank(alice);
        perp.deposit(2000e6);
        
        vm.prank(bob);
        perp.deposit(2000e6);
        
        // Open opposite positions
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 1500e6, true); // Long ETH/BTC
        
        vm.prank(bob);
        perp.openPosition("ETH", "BTC", 1500e6, false); // Short ETH/BTC
        
        // Record initial state
        uint256 totalBalanceBefore = perp.balances(alice) + perp.balances(bob);
        
        // Simulate price change - ETH outperforms BTC by 10%
        oracle.setPrice("ETH", 3300e18); // +10%
        oracle.setPrice("BTC", 59400e18); // -1%
        
        // Close positions
        vm.prank(alice);
        perp.closePosition();
        
        vm.prank(bob);
        perp.closePosition();
        
        // Verify PnL symmetry
        uint256 totalBalanceAfter = perp.balances(alice) + perp.balances(bob);
        
        // Total balance should be conserved (zero-sum)
        assertEq(totalBalanceAfter, totalBalanceBefore, "Total balance not conserved");
        
        // Alice should profit, Bob should lose
        assertTrue(perp.balances(alice) > 2000e6, "Alice should have profit");
        assertTrue(perp.balances(bob) < 2000e6, "Bob should have loss");
        
        // PnL should be exactly opposite
        int256 alicePnL = int256(perp.balances(alice)) - 2000e6;
        int256 bobPnL = int256(perp.balances(bob)) - 2000e6;
        assertEq(alicePnL + bobPnL, 0, "PnL not symmetric");
    }
    
    function test_ForkWithPythOracle() public {
        // This test would use real Pyth oracle
        // For hackathon, we'll skip actual Pyth integration
        // but show the structure
        
        // Switch to Pyth oracle
        // oracle.setPythOracle(PYTH_ORACLE);
        
        // In production, keeper would call:
        // bytes[] memory priceUpdateData = getPythUpdateData();
        // oracle.pushPyth{value: updateFee}(priceUpdateData);
        
        // For now, continue with mock prices
        assertTrue(oracle.useMockPrices(), "Should be in mock mode for hackathon");
    }
    
    function test_LiquidationScenario() public {
        // Setup positions
        oracle.setPrice("ETH", 3000e18);
        oracle.setPrice("BTC", 60000e18);
        
        vm.prank(alice);
        perp.deposit(400e6); // Minimal margin
        
        vm.prank(alice);
        perp.openPosition("ETH", "BTC", 1200e6, true); // 3.3x leverage
        
        // ETH crashes relative to BTC
        oracle.setPrice("ETH", 2400e18); // -20%
        oracle.setPrice("BTC", 66000e18); // +10%
        
        // Check position is underwater
        int256 pnl = perp.getPositionValue(alice);
        assertTrue(pnl < -300e6, "Position should be deeply underwater");
        
        // In V2, liquidation would trigger here
        // For now, user can still close at a loss
        vm.prank(alice);
        perp.closePosition();
        
        // User should have very little or no balance left
        assertTrue(perp.balances(alice) < 100e6, "User should be nearly liquidated");
    }
}