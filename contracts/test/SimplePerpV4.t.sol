// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SimplePerpV4.sol";
import "../src/RatioOracleV2.sol";
import "../src/TokenRegistry.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/interfaces/IPyth.sol";

contract MockPyth is IPyth {
    mapping(bytes32 => Price) public prices;
    
    function setPrice(bytes32 id, int64 price, uint publishTime) external {
        prices[id] = Price({
            price: price,
            conf: 0,
            expo: -8,
            publishTime: publishTime
        });
    }
    
    function getPriceUnsafe(bytes32 id) external view returns (Price memory) {
        return prices[id];
    }
    
    function getPrice(bytes32 id) external view returns (Price memory) {
        Price memory price = prices[id];
        require(price.price > 0, "Price not available");
        require(block.timestamp - price.publishTime <= 60, "Price too old");
        return price;
    }
    
    function updatePriceFeeds(bytes[] calldata) external payable {}
    
    function getUpdateFee(bytes[] calldata) external pure returns (uint) {
        return 1;
    }
}

contract SimplePerpV4Test is Test {
    SimplePerpV4 public perp;
    RatioOracleV2 public oracle;
    TokenRegistry public registry;
    MockUSDC public usdc;
    MockPyth public pyth;
    
    address public owner = address(this);
    address public treasury = address(0x1234);
    address public alice = address(0xABCD);
    address public bob = address(0xDEAD);
    address public liquidator = address(0xBEEF);
    
    bytes32 constant ETH_PRICE_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 constant BTC_PRICE_ID = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    
    function setUp() public {
        // Deploy contracts
        usdc = new MockUSDC();
        pyth = new MockPyth();
        oracle = new RatioOracleV2(address(pyth));
        registry = new TokenRegistry();
        perp = new SimplePerpV4(
            address(usdc),
            address(oracle),
            address(registry),
            treasury
        );
        
        // Setup token registry
        registry.addToken("ETH", address(0), 18, 300); // 3% risk weight
        registry.addToken("BTC", address(0), 18, 300); // 3% risk weight
        
        // Setup initial prices
        pyth.setPrice(ETH_PRICE_ID, 2500e8, block.timestamp);
        pyth.setPrice(BTC_PRICE_ID, 100000e8, block.timestamp);
        
        // Fund users
        usdc.mint(alice, 10000e6);
        usdc.mint(bob, 10000e6);
        usdc.mint(liquidator, 1000e6);
        
        // Approve perp contract
        vm.prank(alice);
        usdc.approve(address(perp), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(perp), type(uint256).max);
        vm.prank(liquidator);
        usdc.approve(address(perp), type(uint256).max);
    }
    
    function test_Deposit() public {
        vm.prank(alice);
        perp.deposit(1000e6);
        
        assertEq(perp.balances(alice), 1000e6);
        assertEq(perp.totalDeposits(), 1000e6);
    }
    
    function test_DepositReentrancy() public {
        // This should fail due to reentrancy guard
        // Would need a malicious token to properly test
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
        
        uint16[] memory tokenIds = new uint16[](1);
        tokenIds[0] = 0; // ETH
        
        int256[] memory notionals = new int256[](1);
        notionals[0] = 10000e6; // $10k long ETH
        
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
        
        (bool isActive, uint256 marginUsed, uint256 totalNotional,,,) = perp.getPosition(alice);
        assertTrue(isActive);
        assertEq(totalNotional, 10000e6);
        assertEq(marginUsed, 300e6); // 3% of 10k
        
        // Check fee collection
        assertEq(perp.protocolFees(), 10e6); // 0.1% of 10k
    }
    
    function test_ClosePositionWithProfit() public {
        // Open position
        vm.prank(alice);
        perp.deposit(1000e6);
        
        uint16[] memory tokenIds = new uint16[](1);
        tokenIds[0] = 0; // ETH
        
        int256[] memory notionals = new int256[](1);
        notionals[0] = 10000e6; // $10k long ETH
        
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
        
        // Increase ETH price (simulate ETH gaining market share)
        pyth.setPrice(ETH_PRICE_ID, 3000e8, block.timestamp);
        
        // Close position
        vm.prank(alice);
        perp.closePosition();
        
        // Should have profit
        assertTrue(perp.balances(alice) > 1000e6 - 310e6); // Initial - margin - fees
    }
    
    function test_ClosePositionWithLoss() public {
        // Open position
        vm.prank(alice);
        perp.deposit(1000e6);
        
        uint16[] memory tokenIds = new uint16[](1);
        tokenIds[0] = 0; // ETH
        
        int256[] memory notionals = new int256[](1);
        notionals[0] = 10000e6; // $10k long ETH
        
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
        
        // Decrease ETH price
        pyth.setPrice(ETH_PRICE_ID, 2000e8, block.timestamp);
        
        // Close position
        vm.prank(alice);
        perp.closePosition();
        
        // Should have loss
        assertTrue(perp.balances(alice) < 1000e6 - 10e6); // Initial - fees
    }
    
    function test_Liquidation() public {
        // Alice opens large position
        vm.prank(alice);
        perp.deposit(1000e6);
        
        uint16[] memory tokenIds = new uint16[](1);
        tokenIds[0] = 0; // ETH
        
        int256[] memory notionals = new int256[](1);
        notionals[0] = 30000e6; // $30k long ETH (high leverage)
        
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
        
        // Price drops significantly
        pyth.setPrice(ETH_PRICE_ID, 1500e8, block.timestamp);
        
        // Check liquidatable
        assertTrue(perp.isLiquidatable(alice));
        
        // Liquidate
        uint256 liquidatorBalanceBefore = perp.balances(liquidator);
        vm.prank(liquidator);
        perp.liquidate(alice);
        
        // Check position closed
        (bool isActive,,,,) = perp.getPosition(alice);
        assertFalse(isActive);
        
        // Liquidator received reward
        assertTrue(perp.balances(liquidator) > liquidatorBalanceBefore);
    }
    
    function test_PositionLimits() public {
        vm.prank(alice);
        perp.deposit(10000e6);
        
        uint16[] memory tokenIds = new uint16[](1);
        tokenIds[0] = 0; // ETH
        
        int256[] memory notionals = new int256[](1);
        notionals[0] = 2000000e6; // $2M (above default limit)
        
        vm.expectRevert("Position too large");
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
    }
    
    function test_PauseUnpause() public {
        perp.pause();
        
        vm.expectRevert("Paused");
        vm.prank(alice);
        perp.deposit(1000e6);
        
        perp.unpause();
        
        vm.prank(alice);
        perp.deposit(1000e6);
        assertEq(perp.balances(alice), 1000e6);
    }
    
    function test_FeeWithdrawal() public {
        // Generate fees
        vm.prank(alice);
        perp.deposit(1000e6);
        
        uint16[] memory tokenIds = new uint16[](1);
        tokenIds[0] = 0; // ETH
        
        int256[] memory notionals = new int256[](1);
        notionals[0] = 10000e6;
        
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
        
        uint256 treasuryBalanceBefore = usdc.balanceOf(treasury);
        uint256 fees = perp.protocolFees();
        
        perp.withdrawFees();
        
        assertEq(usdc.balanceOf(treasury), treasuryBalanceBefore + fees);
        assertEq(perp.protocolFees(), 0);
    }
    
    function test_MultiTokenPosition() public {
        vm.prank(alice);
        perp.deposit(2000e6);
        
        uint16[] memory tokenIds = new uint16[](2);
        tokenIds[0] = 0; // ETH
        tokenIds[1] = 1; // BTC
        
        int256[] memory notionals = new int256[](2);
        notionals[0] = 10000e6; // $10k long ETH
        notionals[1] = -5000e6; // $5k short BTC
        
        vm.prank(alice);
        perp.openPosition(tokenIds, notionals);
        
        (uint16[] memory userTokenIds, int256[] memory exposures) = perp.getUserExposures(alice);
        assertEq(userTokenIds.length, 2);
        assertEq(exposures[0], 10000e6);
        assertEq(exposures[1], -5000e6);
    }
}