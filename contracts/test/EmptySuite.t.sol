// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";

contract EmptySuite is Test {
    function setUp() public {}

    function test_EmptyTest() public {
        assertEq(uint256(1), uint256(1));
    }
}