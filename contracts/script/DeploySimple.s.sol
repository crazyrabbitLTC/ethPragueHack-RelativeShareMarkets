// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SimplePerpV2.sol";
import "../src/RatioOracle.sol";
import "../src/mocks/MockUSDC.sol";

contract DeploySimple is Script {
    function run() external {
        vm.startBroadcast();
        
        // Deploy contracts
        MockUSDC usdc = new MockUSDC();
        RatioOracle oracle = new RatioOracle();
        SimplePerpV2 perp = new SimplePerpV2(address(usdc), address(oracle));
        
        // Setup
        oracle.setPrice("ETH", 3000e18);
        oracle.setPrice("BTC", 60000e18);
        usdc.mint(msg.sender, 10000e6);
        
        vm.stopBroadcast();
        
        // Log addresses
        console.log("MockUSDC:", address(usdc));
        console.log("RatioOracle:", address(oracle));
        console.log("SimplePerpV2:", address(perp));
    }
}