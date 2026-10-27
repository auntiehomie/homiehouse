export const HH2_TOKEN_ADDRESS = '0x5C5F3618e82C4b32e26De858ca66331D9A722B07' as const;
export const HH2_BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;
export const HH2_STAKING_ADDRESS = process.env.NEXT_PUBLIC_HH2_STAKING_CONTRACT_ADDRESS as `0x${string}` | undefined;

export const HH2_TOKEN_ABI = [
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'decimals', stateMutability: 'view',
    inputs: [], outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function', name: 'transfer', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function', name: 'allowance', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const HH2_STAKING_ABI = [
  {
    type: 'function', name: 'stake', stateMutability: 'nonpayable',
    inputs: [
      { name: 'tierId', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
      { name: 'fid', type: 'uint256' },
    ], outputs: [{ name: 'stakeId', type: 'uint256' }],
  },
  {
    type: 'function', name: 'withdraw', stateMutability: 'nonpayable',
    inputs: [{ name: 'stakeId', type: 'uint256' }, { name: 'fid', type: 'uint256' }], outputs: [],
  },
  {
    type: 'event', name: 'Staked', anonymous: false,
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'stakeId', type: 'uint256', indexed: true },
      { name: 'tierId', type: 'uint8', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'unlocksAt', type: 'uint256', indexed: false },
      { name: 'fid', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'Withdrawn', anonymous: false,
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'stakeId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'fid', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'Transfer', anonymous: false,
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const;
