# 📋 Manual Verification Guide for Arbiscan

## 🎯 Contract 1: MockUSDC

**Address:** `0xe2696990894452AbE9ce45ba557979c2cbc6B3dd`

### Steps:
1. **Open Arbiscan**: https://arbiscan.io/address/0xe2696990894452AbE9ce45ba557979c2cbc6B3dd#code
2. Click the **"Verify and Publish"** button
3. **Fill in the form:**
   - **Compiler Type:** `Solidity (Single file)`
   - **Compiler Version:** `v0.8.19+commit.7dd6d404`
   - **Open Source License Type:** `3) MIT License (MIT)`

4. **Contract Code:**
   - Copy ALL content from: `contracts/MockUSDC_flat.sol`
   - Paste into the contract code field

5. **Optimization:**
   - **Optimization:** `Yes`
   - **Runs:** `200`

6. **Other Settings:**
   - **EVM Version:** `default` (leave as is)
   - **Library addresses:** (leave empty)

7. Click **"Verify and Publish"**

---

## 🎯 Contract 2: RatioOracle

**Address:** `0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f`

### Steps:
1. **Open Arbiscan**: https://arbiscan.io/address/0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f#code
2. Click the **"Verify and Publish"** button
3. **Fill in the form:**
   - **Compiler Type:** `Solidity (Single file)`
   - **Compiler Version:** `v0.8.19+commit.7dd6d404`
   - **Open Source License Type:** `3) MIT License (MIT)`

4. **Contract Code:**
   - Copy ALL content from: `contracts/RatioOracle_flat.sol`
   - Paste into the contract code field

5. **Optimization:**
   - **Optimization:** `Yes`
   - **Runs:** `200`

6. Click **"Verify and Publish"**

---

## 🎯 Contract 3: SimplePerpV2

**Address:** `0x99d45f0d21D135D0947F641Ae4C10E00DF820244`

### Steps:
1. **Open Arbiscan**: https://arbiscan.io/address/0x99d45f0d21D135D0947F641Ae4C10E00DF820244#code
2. Click the **"Verify and Publish"** button
3. **Fill in the form:**
   - **Compiler Type:** `Solidity (Single file)`
   - **Compiler Version:** `v0.8.19+commit.7dd6d404`
   - **Open Source License Type:** `3) MIT License (MIT)`

4. **Contract Code:**
   - Copy ALL content from: `contracts/SimplePerpV2_flat.sol`
   - Paste into the contract code field

5. **Constructor Arguments:**
   ```
   000000000000000000000000e2696990894452abe9ce45ba557979c2cbc6b3dd00000000000000000000000073521ace086cdb7c4dd2cb6d9667582ec07f628f
   ```
   ⚠️ **IMPORTANT**: Copy this exactly as shown (no line breaks)

6. **Optimization:**
   - **Optimization:** `Yes`
   - **Runs:** `200`

7. Click **"Verify and Publish"**

---

## 🔧 Troubleshooting

### If you get "ByteCode does not match":
1. Try changing **EVM Version** to `paris`
2. Make sure optimization is set to `Yes` with `200` runs
3. Double-check the compiler version is exactly `v0.8.19+commit.7dd6d404`

### If SimplePerpV2 fails:
The constructor arguments are critical. They represent:
- First address: MockUSDC (`0xe2696990894452AbE9ce45ba557979c2cbc6B3dd`)
- Second address: RatioOracle (`0x73521ACe086cDB7C4dd2cb6D9667582EC07F628f`)

### Alternative Constructor Args Format:
If the above doesn't work, try with "0x" prefix:
```
0x000000000000000000000000e2696990894452abe9ce45ba557979c2cbc6b3dd00000000000000000000000073521ace086cdb7c4dd2cb6d9667582ec07f628f
```

## ✅ Success Indicators
- Green checkmark appears next to "Contract Source Code Verified"
- You can see the contract functions in the "Read Contract" and "Write Contract" tabs
- Source code is visible in the "Contract" tab

## 📝 Notes
- The flattened files are in the `contracts/` directory
- These files include all dependencies in a single file
- The order matters: Verify MockUSDC first, then RatioOracle, then SimplePerpV2