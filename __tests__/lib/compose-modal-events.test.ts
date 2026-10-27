import {
  requestMiniAppComposeCast,
  type OpenComposeModalDetail,
} from '@/lib/compose-modal-events';

describe('requestMiniAppComposeCast', () => {
  it('forwards the Mini App share request and returns the posted cast', async () => {
    let detail: OpenComposeModalDetail | undefined;
    const pending = requestMiniAppComposeCast(
      {
        text: 'Share this',
        embeds: ['https://example.com/app'],
        channelKey: 'farcaster',
      },
      value => {
        detail = value;
      },
    );

    expect(detail).toMatchObject({
      text: 'Share this',
      embeds: ['https://example.com/app'],
      channelKey: 'farcaster',
    });

    detail?.onComplete?.({
      hash: '0xabc',
      text: 'Share this',
      embeds: ['https://example.com/app'],
      channelKey: 'farcaster',
    });

    await expect(pending).resolves.toEqual({
      cast: {
        hash: '0xabc',
        text: 'Share this',
        embeds: ['https://example.com/app'],
        channelKey: 'farcaster',
      },
    });
  });

  it('resolves undefined when the Mini App requested close', async () => {
    let detail: OpenComposeModalDetail | undefined;
    const pending = requestMiniAppComposeCast(
      { text: 'Closing share', close: true },
      value => {
        detail = value;
      },
    );

    detail?.onComplete?.(null);

    await expect(pending).resolves.toBeUndefined();
  });
});
