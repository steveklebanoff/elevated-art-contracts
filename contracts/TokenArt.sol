// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableMap.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

struct TokenArtDetails {
    // stored erc 20 token info
    address[] storedERC20TokenAddresses; // addresses of erc 20 tokens which were stored in erc1155 piece
    uint256[] storedERC20TokenAmounts; // amounts of erc 20 tokens which each piece is entitled to. maps to index in storedERC20TokenAddresses
    uint256 storedERC20TokensAvailableAt; // unix epoch when erc20 tokens can be unlocked
    // embedded erc 1155 info
    address embeddedErc1155Address;
    uint256 embeddedErc1155Id;
    // additional info
    uint256 numPiecesElevated; // how many pieces elevated
    bool burnEmbeddedPieceWhenUnelevated; // if true the embedded piece will be burned when unelevated
    string metadata; // addtl metadata
}

contract TokenArt is
    ERC1155("https://elevated.art/api/token-art-metadata/{id}.json"),
    Ownable,
    ReentrancyGuard
{
    using SafeMath for uint256;
    using EnumerableMap for EnumerableMap.UintToAddressMap;

    // tokenArtId => art details
    mapping(uint256 => TokenArtDetails) public tokenArtDetails;

    // Enumerable mapping from token ids to their creators
    EnumerableMap.UintToAddressMap private _tokenCreators;

    // keep track of last token id minted
    uint256 public lastMintedId;

    // constants
    bytes4 constant onErc1155Res = bytes4(
        keccak256("onERC1155Received(address,address,uint256,uint256,bytes)")
    );

    event Elevated(
        uint256 tokenArtId,
        address embeddedErc1155Address,
        uint256 embeddedErc1155Id,
        uint256 amountToElevate,
        address[] erc20TokenAddresses,
        uint256[] erc20TokenAmountEach,
        uint256 storedERC20TokensAvailableAt,
        bool burnEmbeddedPieceWhenUnelevated,
        string metadata
    );

    event Unelevated(
        uint256 tokenArtId,
        address embeddedErc1155Address,
        uint256 embeddedErc1155Id,
        uint256 amountUnelevated,
        address[] erc20TokenAddresses,
        uint256[] erc20TokenAmountEach,
        uint256 storedERC20TokensAvailableAt,
        address unelevatedBy
    );

    function elevate(
        address embeddedErc1155Address,
        uint256 embeddedErc1155Id,
        uint256 amountToElevate,
        address[] memory erc20TokenAddresses,
        uint256[] memory erc20TokenAmountEach,
        uint256 storedERC20TokensAvailableAt,
        bool burnEmbeddedPieceWhenUnelevated,
        string memory metadata
    ) external payable nonReentrant() returns (uint256) {
        require(
            erc20TokenAddresses.length == erc20TokenAmountEach.length,
            "amount lengths must match"
        );
        require(
            erc20TokenAddresses.length > 0,
            "must embed with at least 1 token"
        );
        require(amountToElevate > 0, "must mint at least 1 token");

        // add 1 to id to generate new token id
        uint256 tokenArtId = lastMintedId = lastMintedId.add(1);
        require(!_exists(tokenArtId), "Token already minted");

        IERC1155 embeddedErc1155 = IERC1155(embeddedErc1155Address);

        // set creator
        _tokenCreators.set(tokenArtId, msg.sender);

        // transfer each erc20 token from owner to contract for specified amount
        for (uint256 j = 0; j < erc20TokenAddresses.length; j++) {
            uint256 totalTokensToTransfer = erc20TokenAmountEach[j].mul(
                amountToElevate
            );

            IERC20 token = IERC20(erc20TokenAddresses[j]);
            SafeERC20.safeTransferFrom(
                token,
                msg.sender,
                address(this),
                totalTokensToTransfer
            );
        }

        // transfer source art over
        embeddedErc1155.safeTransferFrom(
            msg.sender,
            address(this),
            embeddedErc1155Id,
            amountToElevate,
            "0x"
        );

        // mint new TokenArt pieces
        _mint(msg.sender, tokenArtId, amountToElevate, "0x");
        // set struct
        tokenArtDetails[tokenArtId] = TokenArtDetails(
            // erc 20 info
            erc20TokenAddresses,
            erc20TokenAmountEach,
            storedERC20TokensAvailableAt,
            // embedded erc150 info
            embeddedErc1155Address,
            embeddedErc1155Id,
            // additional info
            amountToElevate,
            burnEmbeddedPieceWhenUnelevated,
            metadata
        );

        // emit event
        emit Elevated(
            tokenArtId,
            embeddedErc1155Address,
            embeddedErc1155Id,
            amountToElevate,
            erc20TokenAddresses,
            erc20TokenAmountEach,
            storedERC20TokensAvailableAt,
            burnEmbeddedPieceWhenUnelevated,
            metadata
        );

        return tokenArtId;
    }

    function unelevate(uint256 tokenArtId, uint256 numToUnelevate)
        external
        payable
        nonReentrant()
    {
        require(
            numToUnelevate <= balanceOf(msg.sender, tokenArtId),
            "Must own pieces"
        );

        TokenArtDetails memory artDetails = tokenArtDetails[tokenArtId];
        require(
            block.timestamp >= artDetails.storedERC20TokensAvailableAt,
            "Must be past timelock time"
        );

        // always burn art token by sending to burn address
        // note: sending to address(1) instead of address(0)
        // because openzeppelin doesnt allow the sending to address(0)
        safeTransferFrom(
            msg.sender,
            address(1),
            tokenArtId,
            numToUnelevate,
            "0x"
        );

        // send embedded nft back
        IERC1155 embeddedErc1155 = IERC1155(artDetails.embeddedErc1155Address);
        // send to null address if told to burn, otherwise send to owner
        address embeddedErc1155Destination = artDetails
            .burnEmbeddedPieceWhenUnelevated
            ? address(1)
            : msg.sender;
        embeddedErc1155.safeTransferFrom(
            address(this),
            embeddedErc1155Destination,
            artDetails.embeddedErc1155Id,
            numToUnelevate,
            "0x"
        );

        // send tokens to user
        for (
            uint256 j = 0;
            j < artDetails.storedERC20TokenAddresses.length;
            j++
        ) {
            IERC20 token = IERC20(artDetails.storedERC20TokenAddresses[j]);

            uint256 contractTokenBalance = token.balanceOf(address(this));
            uint256 owedTokens = artDetails.storedERC20TokenAmounts[j].mul(
                numToUnelevate
            );
            // send owed tokens
            if (contractTokenBalance < owedTokens) {
                // send whole balance if theres a rounding error and we dont have enough
                SafeERC20.safeTransfer(token, msg.sender, contractTokenBalance);
            } else {
                SafeERC20.safeTransfer(token, msg.sender, owedTokens);
            }
        }

        // emit event
        emit Unelevated(
            tokenArtId,
            artDetails.embeddedErc1155Address,
            artDetails.embeddedErc1155Id,
            numToUnelevate,
            artDetails.storedERC20TokenAddresses,
            artDetails.storedERC20TokenAmounts,
            artDetails.storedERC20TokensAvailableAt,
            msg.sender
        );
    }

    function creatorOf(uint256 tokenArtId) external view returns (address) {
        return _tokenCreators.get(tokenArtId);
    }

    function getDetails(uint256[] memory tokenArtIds)
        external
        view
        returns (TokenArtDetails[] memory tad, address[] memory creators)
    {
        tad = new TokenArtDetails[](tokenArtIds.length);
        creators = new address[](tokenArtIds.length);
        for (uint256 j = 0; j < tokenArtIds.length; j++) {
            uint256 tokenArtId = tokenArtIds[j];
            tad[j] = (tokenArtDetails[tokenArtId]);
            creators[j] = _tokenCreators.get(tokenArtId);
        }
        return (tad, creators);
    }

    function retrieveTips(uint256 amount) external onlyOwner() returns (bool) {
        // cast address so Ownable thinks owner() is payable
        (bool success, ) = payable(owner()).call{value: amount}("");
        return success;
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4) {
        return onErc1155Res;
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _tokenCreators.contains(tokenId);
    }
}
