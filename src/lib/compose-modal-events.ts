export const OPEN_COMPOSE_MODAL_EVENT = 'openComposeModal';

export type ComposeCastResult = {
  hash: string;
  text?: string;
  embeds?: [] | [string] | [string, string];
  channelKey?: string;
};

export interface OpenComposeModalDetail {
  text?: string;
  embeds?: string[];
  channelKey?: string;
  parentCastHash?: string;
  parentCastFid?: number;
  replyingToName?: string;
  onComplete?: (cast: ComposeCastResult | null) => void;
}

export function openComposeModal(detail: OpenComposeModalDetail): void {
  window.dispatchEvent(new CustomEvent(OPEN_COMPOSE_MODAL_EVENT, { detail }));
}

export function requestMiniAppComposeCast(
  options: {
    text?: string;
    embeds?: string[];
    close?: boolean;
    channelKey?: string;
  },
  dispatch: (detail: OpenComposeModalDetail) => void = openComposeModal,
): Promise<{ cast: ComposeCastResult | null } | undefined> {
  return new Promise(resolve => {
    dispatch({
      text: options.text ?? '',
      embeds: options.embeds ?? [],
      channelKey: options.channelKey,
      onComplete: cast => resolve(options.close ? undefined : { cast }),
    });
  });
}
