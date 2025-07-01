// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SimplePerpV4.sol";
import "../src/RatioOracleV2.sol";
import "../src/TokenRegistry.sol";
import "../src/mocks/MockUSDC.sol";

contract DeployV4 is Script {
    // Arbitrum mainnet addresses
    address constant PYTH_ARBITRUM = 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C;
    address constant USDC_ARBITRUM = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    
    // Deploy addresses
    SimplePerpV4 public perp;
    RatioOracleV2 public oracle;
    TokenRegistry public registry;
    address public collateralToken;
    
    function run() external {
        // Get deployment parameters
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        address treasury = vm.envOr("TREASURY", deployer);
        bool isMainnet = vm.envBool("IS_MAINNET");
        
        console.log("Deploying V4 contracts...");
        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);
        console.log("Network:", isMainnet ? "Arbitrum Mainnet" : "Local/Testnet");
        
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        
        // Deploy or use existing USDC
        if (isMainnet) {
            collateralToken = USDC_ARBITRUM;
            console.log("Using mainnet USDC:", collateralToken);
        } else {
            MockUSDC mockUsdc = new MockUSDC();
            collateralToken = address(mockUsdc);
            console.log("Deployed MockUSDC:", collateralToken);
        }
        
        // Deploy RatioOracleV2
        oracle = new RatioOracleV2(PYTH_ARBITRUM);
        console.log("Deployed RatioOracleV2:", address(oracle));
        
        // Deploy TokenRegistry
        registry = new TokenRegistry();
        console.log("Deployed TokenRegistry:", address(registry));
        
        // Setup initial tokens
        registry.addToken("ETH", address(0), 18, 300); // 3% risk weight
        registry.addToken("BTC", address(0), 18, 300); // 3% risk weight
        console.log("Added ETH and BTC to registry");
        
        // Deploy SimplePerpV4
        perp = new SimplePerpV4(
            collateralToken,
            address(oracle),
            address(registry),
            treasury
        );
        console.log("Deployed SimplePerpV4:", address(perp));
        
        // Save deployment info
        _saveDeployment();
        
        vm.stopBroadcast();
        
        console.log("\nDeployment complete!");
        console.log("Run verification with:");
        console.log("forge verify-contract", address(perp), "SimplePerpV4 --constructor-args", _getConstructorArgs());
    }
    
    function _saveDeployment() internal {
        string memory json = "deployment";
        vm.serializeAddress(json, "simplePerpV4", address(perp));
        vm.serializeAddress(json, "ratioOracleV2", address(oracle));
        vm.serializeAddress(json, "tokenRegistry", address(registry));
        vm.serializeAddress(json, "collateralToken", collateralToken);
        vm.serializeAddress(json, "pyth", PYTH_ARBITRUM);
        
        string memory output = vm.serializeUint(json, "timestamp", block.timestamp);
        
        vm.writeJson(output, "./deployments/v4-deployment.json");
    }
    
    function _getConstructorArgs() internal view returns (bytes memory) {
        return abi.encode(
            collateralToken,
            address(oracle),
            address(registry),
            vm.envOr("TREASURY", vm.addr(vm.envUint("PRIVATE_KEY")))
        );
    }
}