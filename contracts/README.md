# Homiefy PFP NFT

`HomiefyPFP.sol` is an ERC-721 collection contract intended for Base.

- Hard cap: 10,000 minted portraits.
- Each wallet can mint one portrait for free.
- Later mints from that wallet cost exactly 0.0005 ETH.
- Paid mints send ETH directly to the configured treasury.
- Token metadata URI must use the `ipfs://` scheme.
- A wallet can change the internal Homiehouse portrait without minting again; changing the NFT image requires a new token.

## Before deployment

1. Install and pin OpenZeppelin Contracts 5.x in the chosen Solidity build environment.
2. Compile and test the contract, including free mint, paid mint, wrong payment, duplicate free mint, sold-out, invalid URI, and reentrancy cases.
3. Deploy to Base with the approved treasury wallet; verify the source and record the contract address.
4. Set `NEXT_PUBLIC_HOMIEFY_PFP_CONTRACT_ADDRESS` and `NEXT_PUBLIC_HOMIEFY_PFP_CHAIN_ID=8453` in the Homiehouse deployment.
5. Keep the treasury address separate from a deployer key. Never put a private key in client configuration.

The web application does not deploy this contract automatically. The app's mint button remains unavailable until a verified contract address is configured.
