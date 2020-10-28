// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestableERC20 is ERC20("Testable", "TST") {
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
