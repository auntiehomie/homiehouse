import { publishWithStoredKey } from '@/lib/scheduled-cast-publisher';
import { buildSignedMessage, CastType } from '@/lib/fc-message-builder';
import { submitHypersnapMessage } from '@/lib/hypersnap-submit';
import { decryptSignerKey } from '@/lib/signer-crypto';

jest.mock('@/lib/fc-message-builder', () => ({
  ...jest.requireActual('@/lib/fc-message-builder'),
  buildSignedMessage: jest.fn().mockResolvedValue(Uint8Array.of(1, 2, 3)),
}));
jest.mock('@/lib/hypersnap-submit', () => ({ submitHypersnapMessage: jest.fn() }));
jest.mock('@/lib/signer-crypto', () => ({ decryptSignerKey: jest.fn() }));
jest.mock('@/lib/hypersnap', () => ({ fetchChannelParentUrl: jest.fn().mockResolvedValue('https://example.com/channel') }));

const hash = '0x' + 'a'.repeat(40);
const cast = { user_fid: 3103, signer_uuid: 'encrypted', text: 'hello', embeds: [{ url: 'https://example.com/photo.png' }] };
const submit = jest.mocked(submitHypersnapMessage);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(decryptSignerKey).mockReturnValue('01'.repeat(32));
  submit.mockResolvedValue(Response.json({ hash }));
});

it.each([
  ['x'.repeat(320), CastType.CAST],
  ['x'.repeat(321), CastType.LONG_CAST],
  ['🏠'.repeat(81), CastType.LONG_CAST],
])('signs scheduled text with its correct byte-based type', async (text, type) => {
  await expect(publishWithStoredKey({ ...cast, text, channel_id: 'test' })).resolves.toBe(hash);
  expect(buildSignedMessage).toHaveBeenCalledWith(expect.objectContaining({ fid: 3103, body: { castAddBody: {
    text, type, embeds: cast.embeds, parent: { url: 'https://example.com/channel' },
  } } }), expect.anything());
  expect(submit).toHaveBeenCalledWith(Uint8Array.of(1, 2, 3).buffer);
});

it('preserves the node detail instead of its generic submit error', async () => {
  submit.mockResolvedValue(Response.json({ error: 'Failed to submit message', error_detail: 'text exceeds 320 bytes' }, { status: 400 }));
  await expect(publishWithStoredKey(cast)).rejects.toThrow('text exceeds 320 bytes');
});

it.each([{ ok: false, hash }, { success: false, hash }, {}, { hash: 'bad' }])('does not mark an unconfirmed response as published: %j', async data => {
  submit.mockResolvedValue(Response.json(data));
  await expect(publishWithStoredKey(cast)).rejects.toThrow();
});

it('fails before submission when the key cannot be decrypted', async () => {
  jest.mocked(decryptSignerKey).mockReturnValue(null);
  await expect(publishWithStoredKey(cast)).rejects.toThrow('Re-schedule');
  expect(submit).not.toHaveBeenCalled();
});

it('rejects oversized scheduled casts before submission', async () => {
  await expect(publishWithStoredKey({ ...cast, text: 'a'.repeat(1025) })).rejects.toThrow('thread');
  expect(submit).not.toHaveBeenCalled();
});
