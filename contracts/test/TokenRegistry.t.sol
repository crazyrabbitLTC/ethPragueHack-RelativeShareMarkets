// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/TokenRegistry.sol";

contract TokenRegistryTest is Test {
    TokenRegistry public registry;
    
    address public admin = address(0x1);
    address public user = address(0x2);
    
    event TokenAdded(uint16 indexed tokenId, string symbol, address token, uint8 decimals, uint16 riskWeight);
    event TokenUpdated(uint16 indexed tokenId, uint16 newRiskWeight);
    event RegistryLocked();
    
    function setUp() public {
        vm.prank(admin);
        registry = new TokenRegistry();
    }
    
    function test_AddToken() public {
        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit TokenAdded(0, "ETH", address(0x100), 18, 100);
        registry.addToken("ETH", address(0x100), 18, 100);
        
        // Verify token was added
        (address token, uint8 decimals, uint16 riskWeight, bool active,) = registry.tokens(0);
        assertEq(token, address(0x100));
        assertEq(decimals, 18);
        assertEq(riskWeight, 100);
        assertTrue(active);
        
        // Verify symbol mapping
        assertEq(registry.symbolToId("ETH"), 0);
        assertEq(registry.idToSymbol(0), "ETH");
        assertEq(registry.nextTokenId(), 1);
    }
    
    function test_AddMultipleTokens() public {
        vm.startPrank(admin);
        
        registry.addToken("ETH", address(0x100), 18, 100);
        registry.addToken("BTC", address(0x200), 8, 100);
        registry.addToken("SOL", address(0x300), 9, 150);
        
        vm.stopPrank();
        
        assertEq(registry.nextTokenId(), 3);
        assertEq(registry.symbolToId("BTC"), 1);
        assertEq(registry.symbolToId("SOL"), 2);
    }
    
    function test_CannotAddDuplicateSymbol() public {
        vm.startPrank(admin);
        
        registry.addToken("ETH", address(0x100), 18, 100);
        
        vm.expectRevert("Symbol already exists");
        registry.addToken("ETH", address(0x200), 18, 100);
        
        vm.stopPrank();
    }
    
    function test_OnlyOwnerCanAddToken() public {
        vm.prank(user);
        vm.expectRevert("Only owner");
        registry.addToken("ETH", address(0x100), 18, 100);
    }
    
    function test_UpdateRiskWeight() public {
        vm.prank(admin);
        registry.addToken("ETH", address(0x100), 18, 100);
        
        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit TokenUpdated(0, 150);
        registry.updateRiskWeight(0, 150);
        
        (,, uint16 riskWeight,,) = registry.tokens(0);
        assertEq(riskWeight, 150);
    }
    
    function test_LockRegistry() public {
        vm.prank(admin);
        registry.addToken("ETH", address(0x100), 18, 100);
        
        vm.prank(admin);
        vm.expectEmit(false, false, false, true);
        emit RegistryLocked();
        registry.lockRegistry();
        
        assertTrue(registry.registryLocked());
        
        // Cannot add tokens after locking
        vm.prank(admin);
        vm.expectRevert("Registry is locked");
        registry.addToken("BTC", address(0x200), 8, 100);
    }
    
    function test_GetTokenArray() public {
        vm.startPrank(admin);
        
        registry.addToken("ETH", address(0x100), 18, 100);
        registry.addToken("BTC", address(0x200), 8, 100);
        registry.addToken("SOL", address(0x300), 9, 150);
        
        vm.stopPrank();
        
        uint16[] memory ids = new uint16[](2);
        ids[0] = 0;
        ids[1] = 2;
        
        TokenRegistry.TokenMeta[] memory tokens = registry.getTokens(ids);
        
        assertEq(tokens.length, 2);
        assertEq(tokens[0].token, address(0x100));
        assertEq(tokens[0].symbol, "ETH");
        assertEq(tokens[1].token, address(0x300));
        assertEq(tokens[1].symbol, "SOL");
    }
    
    function test_MaxTokensLimit() public {
        vm.startPrank(admin);
        
        // Add 8 tokens (max for hackathon)
        for (uint16 i = 0; i < 8; i++) {
            registry.addToken(
                string(abi.encodePacked("TKN", i)), 
                address(uint160(0x100 + i)), 
                18, 
                100
            );
        }
        
        // 9th token should fail
        vm.expectRevert("Max tokens reached");
        registry.addToken("EXTRA", address(0x900), 18, 100);
        
        vm.stopPrank();
    }
}