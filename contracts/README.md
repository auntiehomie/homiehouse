# HH2 staking contract

`HH2Staking.sol` is the on-chain escrow used by Homiehouse's HH2 staking UI. It is non-upgradeable and has no owner or privileged withdrawal path. It holds HH2 until each user's selected lock period ends.

Before enabling the staking UI:

1. Compile and review the contract, then deploy it to Base with the HH2 token address `0x5C5F3618e82C4b32e26De858ca66331D9A722B07`.
2. Verify the deployed source on BaseScan and confirm the token and tier bounds.
3. Set `NEXT_PUBLIC_HH2_STAKING_CONTRACT_ADDRESS` to the verified address in the Homiehouse deployment environment.
4. Confirm allowance, stake, early-withdraw rejection, and mature withdrawal on Base Sepolia before production use.

The app's stake ledger verifies successful contract events before it applies a learning multiplier. The user must first approve the exact HH2 stake amount in their wallet; the contract never requests an unlimited approval.
