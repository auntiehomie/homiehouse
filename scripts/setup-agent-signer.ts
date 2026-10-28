/**
 * The old script registered signers through Warpcast's Signed Key Request API.
 * New signers must use the custody-signed Hypersnap flow in HomieHouse.
 * This guard keeps the historical npm command from silently using that API.
 */
console.error([
  'This signer setup script is retired.',
  'Open HomieHouse, connect the FID custody wallet, and use the Hypersnap signer setup flow.',
  'The app mnemonic is not needed in this script; no signer request was made.',
].join('\n'));
process.exitCode = 1;
