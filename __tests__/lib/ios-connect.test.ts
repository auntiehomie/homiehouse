/** The native host invokes this adapter only in its pinned, top-level web view. */
let effectCleanup: (() => void) | undefined;
const mockSubmit = jest.fn();
const mockReply = jest.fn();
let mockAuthenticated = true;
let mockActiveSigner = true;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useEffect: (effect: () => () => void) => { effectCleanup = effect(); },
}));
jest.mock('@/components/SignInButton', () => () => null);
jest.mock('@/components/SignerManager', () => () => null);
jest.mock('@/lib/farcaster-auth', () => ({ useFarcasterAuth: () => ({ fid: 42, isAuthenticated: mockAuthenticated, signOut: jest.fn() }) }));
jest.mock('@/hooks/useFarcasterWrites', () => ({ useFarcasterWrites: () => ({ hasActiveSigner: mockActiveSigner, submitCast: mockSubmit, reply: mockReply }) }));
import IOSConnectPage from '@/app/ios-connect/page';

type Bridge = {
  status: () => { fid: number | null; canPublish: boolean };
  publish: (input: { text: string; parentHash?: string; parentFid?: number }) => Promise<string>;
  restoreAccount: (account: { fid: number; signer: string; profile: string }) => boolean;
};
const storage = new Map<string, string>();
const bridge = () => (window as unknown as { homiehouseIOS: Bridge }).homiehouseIOS;
beforeEach(() => {
  jest.clearAllMocks(); storage.clear(); mockAuthenticated = true; mockActiveSigner = true;
  Object.assign(globalThis, {
    window: { dispatchEvent: jest.fn() },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
  });
  mockSubmit.mockResolvedValue({ castHash: 'acknowledged' });
  mockReply.mockResolvedValue({ castHash: 'reply' });
  IOSConnectPage();
});
afterEach(() => effectCleanup?.());
it('keeps identity-only sessions read only', async () => {
  mockActiveSigner = false; IOSConnectPage();
  expect(bridge().status()).toEqual({ fid: 42, canPublish: false });
  await expect(bridge().publish({ text: 'hello' })).rejects.toThrow('approve a signer');
  expect(mockSubmit).not.toHaveBeenCalled();
});
it('rejects an oversized Unicode cast before signing', async () => {
  await expect(bridge().publish({ text: '🌱'.repeat(257) })).rejects.toThrow('1,024');
  expect(mockSubmit).not.toHaveBeenCalled();
});
it('preserves reply identity and parent hash', async () => {
  const hash = '0x' + 'ab'.repeat(20);
  await expect(bridge().publish({ text: 'reply', parentHash: hash, parentFid: 123 })).resolves.toBe('reply');
  expect(mockReply).toHaveBeenCalledWith({ text: 'reply', parentCastHash: hash, parentCastFid: 123 });
  expect(mockSubmit).not.toHaveBeenCalled();
});
it('rejects malformed reply targets', async () => {
  await expect(bridge().publish({ text: 'reply', parentHash: 'wrong', parentFid: 123 })).rejects.toThrow('Invalid reply');
});
it('keeps an unacknowledged publication from being reported as successful', async () => {
  mockSubmit.mockResolvedValue({ castHash: '' });
  await expect(bridge().publish({ text: 'hello' })).rejects.toThrow('did not acknowledge');
});
it('rejects credentials saved for a different identity', () => {
  expect(() => bridge().restoreAccount({ fid: 42, signer: JSON.stringify({ status: 'approved', private_key: 'ab'.repeat(32) }), profile: JSON.stringify({ fid: 99 }) })).toThrow('could not be restored');
  expect(storage.size).toBe(0);
});
