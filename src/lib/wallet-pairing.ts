interface PairingProvider {
  on(event: 'display_uri', listener: (uri: string) => void): unknown;
  removeListener(event: 'display_uri', listener: (uri: string) => void): unknown;
}

export function subscribePairingUri(provider: unknown, onUri: (uri: string) => void): () => void {
  if (!provider || typeof (provider as PairingProvider).on !== 'function' ||
      typeof (provider as PairingProvider).removeListener !== 'function') {
    throw new Error('This wallet cannot display a pairing code. Please choose another wallet.');
  }
  const pairingProvider = provider as PairingProvider;
  const listener = (uri: string) => {
    if (typeof uri === 'string' && uri.startsWith('wc:')) onUri(uri);
  };
  pairingProvider.on('display_uri', listener);
  return () => { pairingProvider.removeListener('display_uri', listener); };
}
