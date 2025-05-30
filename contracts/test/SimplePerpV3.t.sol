// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SimplePerpV3.sol";
import "../src/TokenRegistry.sol";
import "../src/RatioOracle.sol";
import "../src/mocks/MockUSDC.sol";

contract SimplePerpV3Test is Test {
    SimplePerpV3 public perp;
    TokenRegistry public registry;
    RatioOracle public oracle;
    MockUSDC public usdc;
    
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public charlie = address(0x3);
    address public admin = address(0x4);
    
    uint16 constant ETH_ID = 0;
    uint16 constant BTC_ID = 1;
    uint16 constant SOL_ID = 2;
    
    event TradeExecuted(
        address indexed user,
        uint16[] tokenIds,
        int256[] exposureDeltas,
        uint256 requiredMargin,
        uint256 timestamp
    );
    
    event ExposureUpdated(
        address indexed user,
        uint16 indexed tokenId,
        int256 newExposure,
        int256 delta
    );
    
    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy contracts
        usdc = new MockUSDC();
        oracle = new RatioOracle();
        registry = new TokenRegistry();
        perp = new SimplePerpV3(address(usdc), address(oracle), address(registry));
        
        // Setup token registry
        registry.addToken("ETH", address(0x100), 18, 100); // 1% risk weight
        registry.addToken("BTC", address(0x200), 8, 100);  // 1% risk weight
        registry.addToken("SOL", address(0x300), 9, 150);  // 1.5% risk weight
        
        // Setup mock prices
        oracle.setPrice("ETH", 3000e18);
        oracle.setPrice("BTC", 60000e18);
        oracle.setPrice("SOL", 100e18);
        
        vm.stopPrank();
        
        // Fund users
        usdc.mint(alice, 100000e6);
        usdc.mint(bob, 100000e6);
        usdc.mint(charlie, 100000e6);
        
        // Approve perp
        vm.prank(alice);
        usdc.approve(address(perp), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(perp), type(uint256).max);
        vm.prank(charlie);
        usdc.approve(address(perp), type(uint256).max);
    }
    
    function test_OpenVectorPosition() public {
        vm.prank(alice);
        perp.deposit(10000e6);
        
        // Open ETH vs BTC position: Long $30k ETH, Short $30k BTC
        uint16[] memory tokenIds = new uint16[](2);
        tokenIds[0] = ETH_ID;
        tokenIds[1] = BTC_ID;
        
        int256[] memory notionals = new int256[](2);
        notionals[0] = 30000e6;   // Long ETH
        notionals[1] = -30000e6;  // Short BTC
        
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
        
        // Check user exposures
        assertEq(perp.userExposure(alice, ETH_ID), 30000e6);
        assertEq(perp.userExposure(alice, BTC_ID), -30000e6);
        
        // Check global net exposures
        assertEq(perp.tokenNetExposure(ETH_ID), 30000e6);
        assertEq(perp.tokenNetExposure(BTC_ID), -30000e6);
    }
    
    function test_MarginCalculation() public {
        vm.prank(alice);
        perp.deposit(10000e6);
        
        // ETH/BTC/SOL basket position
        uint16[] memory tokenIds = new uint16[](3);
        tokenIds[0] = ETH_ID;
        tokenIds[1] = BTC_ID;
        tokenIds[2] = SOL_ID;
        
        int256[] memory notionals = new int256[](3);
        notionals[0] = 30000e6;   // Long ETH
        notionals[1] = -20000e6;  // Short BTC
        notionals[2] = -10000e6;  // Short SOL
        
        // Required margin = 30k * 1% + 20k * 1% + 10k * 1.5% = 300 + 200 + 150 = $650
        uint256 expectedMargin = 650e6;
        
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
        
        // Verify margin was correctly calculated
        assertEq(perp.usedMargin(alice), expectedMargin);
    }
    
    function test_InternalNetting() public {
        // Alice and Bob deposit
        vm.prank(alice);
        perp.deposit(10000e6);
        
        vm.prank(bob);
        perp.deposit(10000e6);
        
        // Alice: Long $30k ETH, Short $30k BTC
        uint16[] memory tokenIds = new uint16[](2);
        tokenIds[0] = ETH_ID;
        tokenIds[1] = BTC_ID;
        
        int256[] memory aliceNotionals = new int256[](2);
        aliceNotionals[0] = 30000e6;
        aliceNotionals[1] = -30000e6;
        
        vm.prank(alice);
        perp.openPosition(tokenIds, aliceNotionals);
        
        // Bob: Short $30k ETH, Long $30k BTC (exact opposite)
        int256[] memory bobNotionals = new int256[](2);
        bobNotionals[0] = -30000e6;
        bobNotionals[1] = 30000e6;
        
        vm.prank(bob);
        perp.openPosition(tokenIds, bobNotionals);
        
        // Global net exposure should be zero (perfect netting)
        assertEq(perp.tokenNetExposure(ETH_ID), 0);
        assertEq(perp.tokenNetExposure(BTC_ID), 0);
        
        // Individual exposures still exist
        assertEq(perp.userExposure(alice, ETH_ID), 30000e6);
        assertEq(perp.userExposure(bob, ETH_ID), -30000e6);
    }
    
    function test_CloseVectorPosition() public {
        vm.prank(alice);
        perp.deposit(10000e6);
        
        // Open position
        uint16[] memory tokenIds = new uint16[](2);
        tokenIds[0] = ETH_ID;
        tokenIds[1] = BTC_ID;
        
        int256[] memory notionals = new int256[](2);
        notionals[0] = 30000e6;
        notionals[1] = -30000e6;
        
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
        
        // Change prices
        oracle.setPrice("ETH", 3300e18); // +10%
        oracle.setPrice("BTC", 57000e18); // -5%
        
        // Close position
        vm.prank(alice);
        perp.closePosition();
        
        // All exposures should be zero
        assertEq(perp.userExposure(alice, ETH_ID), 0);
        assertEq(perp.userExposure(alice, BTC_ID), 0);
        
        // Global exposures should also be zero
        assertEq(perp.tokenNetExposure(ETH_ID), 0);
        assertEq(perp.tokenNetExposure(BTC_ID), 0);
        
        // User should have profit (ETH up 10%, BTC down 5%)
        assertTrue(perp.balances(alice) > 10000e6);
    }
    
    function test_PartialNetting() public {
        // Three users with different positions
        vm.prank(alice);
        perp.deposit(10000e6);
        vm.prank(bob);
        perp.deposit(10000e6);
        vm.prank(charlie);
        perp.deposit(10000e6);
        
        uint16[] memory tokenIds = new uint16[](2);
        tokenIds[0] = ETH_ID;
        tokenIds[1] = BTC_ID;
        
        // Alice: Long $50k ETH, Short $50k BTC
        int256[] memory aliceNotionals = new int256[](2);
        aliceNotionals[0] = 50000e6;
        aliceNotionals[1] = -50000e6;
        
        vm.prank(alice);
        perp.openPosition(tokenIds, aliceNotionals);
        
        // Bob: Short $30k ETH, Long $30k BTC
        int256[] memory bobNotionals = new int256[](2);
        bobNotionals[0] = -30000e6;
        bobNotionals[1] = 30000e6;
        
        vm.prank(bob);
        perp.openPosition(tokenIds, bobNotionals);
        
        // Charlie: Long $10k ETH, Short $10k BTC
        int256[] memory charlieNotionals = new int256[](2);
        charlieNotionals[0] = 10000e6;
        charlieNotionals[1] = -10000e6;
        
        vm.prank(charlie);
        perp.openPosition(tokenIds, charlieNotionals);
        
        // Net exposure: ETH = +50k -30k +10k = +30k
        // Net exposure: BTC = -50k +30k -10k = -30k
        assertEq(perp.tokenNetExposure(ETH_ID), 30000e6);
        assertEq(perp.tokenNetExposure(BTC_ID), -30000e6);
    }
    
    function test_GetGlobalExposures() public {
        vm.prank(alice);
        perp.deposit(10000e6);
        
        // Open multi-token position
        uint16[] memory tokenIds = new uint16[](3);
        tokenIds[0] = ETH_ID;
        tokenIds[1] = BTC_ID;
        tokenIds[2] = SOL_ID;
        
        int256[] memory notionals = new int256[](3);
        notionals[0] = 30000e6;
        notionals[1] = -20000e6;
        notionals[2] = -10000e6;
        
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
        
        // Get all non-zero exposures
        (uint16[] memory activeTokens, int256[] memory exposures) = perp.getGlobalExposures();
        
        assertEq(activeTokens.length, 3);
        assertEq(exposures.length, 3);
        
        // Verify values
        assertEq(activeTokens[0], ETH_ID);
        assertEq(exposures[0], 30000e6);
        assertEq(activeTokens[1], BTC_ID);
        assertEq(exposures[1], -20000e6);
        assertEq(activeTokens[2], SOL_ID);
        assertEq(exposures[2], -10000e6);
    }
    
    function test_MaxExposureCheck() public {
        vm.prank(alice);
        perp.deposit(1000e6); // Small deposit
        
        // Try to open position larger than allowed
        uint16[] memory tokenIds = new uint16[](1);
        tokenIds[0] = ETH_ID;
        
        int256[] memory notionals = new int256[](1);
        notionals[0] = 200000e6; // $200k position with only $1k deposit
        
        vm.expectRevert("Insufficient margin");
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
    }
}