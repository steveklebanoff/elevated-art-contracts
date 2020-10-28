# token art

## Description

TokenArt allows for the creation of NFTs that contain:

- 1 arbitrary embedded 1155
- any amount of arbitrary embedded erc-20s

# Flow:

- user buys a dope art piece (referred to as "embeddedErc1155" in the code) from Rarible

- user calls the 'elevate' function on the TokenArt contract to add some erc-20s (referred to as "storedErc20Tokens" in the code) to that dope art piece, wrapped up in a new TokenArt piece

- user sells the piece to buyer

- if buyer ever wants to withdraw the erc20s, they have to call "unelevate"

- "unelevate" will withdraw the erc-20s and send the original dope rarible piece (the "embeddedErc1155") to them

There are also some neat little bonus features:

- the minter (person who elevates a piece) can specify a `storedERC20TokensAvailableAt` timestamp which will not allow the erc 20s to be withdrawn until that date passes.

- the minter can choose for the art piece ("embeddedErc1155") to be effectively "burned" (sent to null address) when the tokens are unwrapped. imagine a piggy bank artwork that stores CDAI and the piggy bank disappears when you withdraw the CDAI :)
