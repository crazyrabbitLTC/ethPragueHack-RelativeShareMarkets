// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SimplePerpV2.sol";
import "../src/RatioOracle.sol";
import "../src/mocks/MockUSDC.sol";

contract DeployAndVerifyScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("\n=====================================");
        console.log("Deploying to Arbitrum One");
        console.log("=====================================");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance / 1e18, "ETH");
        console.log("=====================================\n");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy MockUSDC
        console.log("Deploying MockUSDC...");
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));
        
        // Deploy RatioOracle
        console.log("\nDeploying RatioOracle...");
        RatioOracle oracle = new RatioOracle();
        console.log("RatioOracle deployed at:", address(oracle));
        
        // Deploy SimplePerpV2
        console.log("\nDeploying SimplePerpV2...");
        SimplePerpV2 perp = new SimplePerpV2(address(usdc), address(oracle));
        console.log("SimplePerpV2 deployed at:", address(perp));
        
        // Set initial mock prices
        console.log("\nSetting initial prices...");
        oracle.setPrice("ETH", 3000e18);
        oracle.setPrice("BTC", 60000e18);
        console.log("Prices set: ETH=$3000, BTC=$60000");
        
        // Mint some USDC to deployer for testing
        console.log("\nMinting USDC to deployer...");
        usdc.mint(deployer, 10000e6);
        console.log("Minted 10,000 USDC");
        
        vm.stopBroadcast();
        
        // Save deployment addresses
        console.log("\n=====================================");
        console.log("Deployment Summary");
        console.log("=====================================");
        console.log("Network: Arbitrum One");
        console.log("MockUSDC:", address(usdc));
        console.log("RatioOracle:", address(oracle));
        console.log("SimplePerpV2:", address(perp));
        console.log("=====================================\n");
        
        // Save to JSON
        string memory deployments = string(
            abi.encodePacked(
                '{\n',
                '  "network": "arbitrum",\n',
                '  "chainId": 42161,\n',
                '  "deployer": "', vm.toString(deployer), '",\n',
                '  "deploymentBlock": ', vm.toString(block.number), ',\n',
                '  "deploymentTimestamp": ', vm.toString(block.timestamp), ',\n',
                '  "contracts": {\n',
                '    "MockUSDC": "', vm.toString(address(usdc)), '",\n',
                '    "RatioOracle": "', vm.toString(address(oracle)), '",\n',
                '    "SimplePerpV2": "', vm.toString(address(perp)), '"\n',
                '  },\n',
                '  "verified": false\n',
                '}'
            )
        );
        
        vm.writeFile("./deployments/arbitrum.json", deployments);
        console.log("Deployment addresses saved to deployments/arbitrum.json");
        
        // Verification instructions
        console.log("\n=====================================");
        console.log("Verification Instructions");
        console.log("=====================================");
        console.log("To verify contracts on Arbiscan, run:");
        console.log("");
        console.log("forge verify-contract \\");
        console.log("  --chain-id 42161 \\");
        console.log("  --watch \\");
        console.log(string(abi.encodePacked("  ", vm.toString(address(usdc)), " MockUSDC")));
        console.log("");
        console.log("forge verify-contract \\");
        console.log("  --chain-id 42161 \\");
        console.log("  --watch \\");
        console.log(string(abi.encodePacked("  ", vm.toString(address(oracle)), " RatioOracle")));
        console.log("");
        console.log("forge verify-contract \\");
        console.log("  --chain-id 42161 \\");
        console.log("  --constructor-args ", vm.toString(abi.encode(address(usdc), address(oracle))), " \\");
        console.log("  --watch \\");
        console.log(string(abi.encodePacked("  ", vm.toString(address(perp)), " SimplePerpV2")));
        console.log("=====================================\n");
    }
}