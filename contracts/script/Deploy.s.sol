// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SimplePerpV2.sol";
import "../src/RatioOracle.sol";
import "../src/mocks/MockUSDC.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));
        
        // Deploy RatioOracle
        RatioOracle oracle = new RatioOracle();
        console.log("RatioOracle deployed at:", address(oracle));
        
        // Deploy SimplePerpV2
        SimplePerpV2 perp = new SimplePerpV2(address(usdc), address(oracle));
        console.log("SimplePerpV2 deployed at:", address(perp));
        
        // Set initial mock prices
        oracle.setPrice("ETH", 3000e18);
        oracle.setPrice("BTC", 60000e18);
        console.log("Initial prices set: ETH=$3000, BTC=$60000");
        
        // Mint some USDC to deployer for testing
        usdc.mint(deployer, 10000e6);
        console.log("Minted 10,000 USDC to deployer");
        
        vm.stopBroadcast();
        
        // Save deployment addresses
        string memory deployments = string(
            abi.encodePacked(
                '{\n',
                '  "network": "arbitrum",\n',
                '  "contracts": {\n',
                '    "MockUSDC": "', vm.toString(address(usdc)), '",\n',
                '    "RatioOracle": "', vm.toString(address(oracle)), '",\n',
                '    "SimplePerpV2": "', vm.toString(address(perp)), '"\n',
                '  }\n',
                '}'
            )
        );
        
        vm.writeFile("./deployments/arbitrum.json", deployments);
        console.log("Deployment addresses saved to deployments/arbitrum.json");
    }
}