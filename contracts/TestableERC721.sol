// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TestableERC721 is ERC721("TestableERC721", "TST") {
    function mint(address to, uint256 tokenId) public {
        _mint(to, tokenId);
    }
}
