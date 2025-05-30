# Manual Contract Verification on Arbiscan

Since automated verification is having issues, here's how to verify manually on Arbiscan:

## Contract Addresses
- **MockUSDC**: `0xe2696990894452AbE9ce45ba557979c2cbc6B3dd`
- **RatioOracle**: `0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f`
- **SimplePerpV2**: `0x99d45f0d21D135D0947F641Ae4C10E00DF820244`

## Verification Steps

### 1. MockUSDC
1. Go to: https://arbiscan.io/address/0xe2696990894452AbE9ce45ba557979c2cbc6B3dd#code
2. Click "Verify and Publish"
3. Settings:
   - Compiler Type: `Solidity (Single file)`
   - Compiler Version: `v0.8.19+commit.7dd6d404`
   - License: `MIT`
4. Copy the entire content of `contracts/src/mocks/MockUSDC.sol`
5. Optimization: `Yes` with `200` runs
6. Click "Verify and Publish"

### 2. RatioOracle
1. Go to: https://arbiscan.io/address/0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f#code
2. Click "Verify and Publish"
3. Settings:
   - Compiler Type: `Solidity (Single file)`
   - Compiler Version: `v0.8.19+commit.7dd6d404`
   - License: `MIT`
4. Copy the content of `contracts/src/RatioOracle.sol`
5. Also copy the `IPyth` interface from `contracts/src/interfaces/IPyth.sol` at the top
6. Optimization: `Yes` with `200` runs
7. Click "Verify and Publish"

### 3. SimplePerpV2
1. Go to: https://arbiscan.io/address/0x99d45f0d21D135D0947F641Ae4C10E00DF820244#code
2. Click "Verify and Publish"
3. Settings:
   - Compiler Type: `Solidity (Single file)`
   - Compiler Version: `v0.8.19+commit.7dd6d404`
   - License: `MIT`
4. Copy the content of `contracts/src/SimplePerpV2.sol`
5. Constructor Arguments:
   ```
   000000000000000000000000e2696990894452abe9ce45ba557979c2cbc6b3dd
   00000000000000000000000073521ace086cdb7c4dd2cb6d9667582ec07f628f
   ```
6. Optimization: `Yes` with `200` runs
7. Click "Verify and Publish"

## Alternative: Use Flattened Files

If single file doesn't work, use forge to flatten:

```bash
cd contracts
forge flatten src/mocks/MockUSDC.sol > MockUSDC_flat.sol
forge flatten src/RatioOracle.sol > RatioOracle_flat.sol
forge flatten src/SimplePerpV2.sol > SimplePerpV2_flat.sol
```

Then use the flattened files for verification.

## Compiler Settings Used
- Solidity: 0.8.19
- Optimizer: Enabled
- Runs: 200
- EVM Version: Paris
- Via IR: Yes (enabled in foundry.toml)